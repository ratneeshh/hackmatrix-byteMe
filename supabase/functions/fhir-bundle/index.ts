/**
 * fhir-bundle/index.ts  — MediScribe FHIR R4 Bundle Generator
 *
 * Called by analyse/index.ts (server-to-server, fire-and-forget).
 *
 * Flow:
 *   1. Fetch session + patient + doctor + soap_note from DB
 *   2. Build FHIR R4 resources: Patient, Encounter, Observation[], Condition[], MedicationRequest[], CarePlan
 *   3. Wrap in a transaction Bundle
 *   4. INSERT into fhir_bundles table
 *   5. Upload raw JSON to Supabase Storage (fhir/{doctor_id}/{session_id}.json)
 *   6. Broadcast fhir_ready via Realtime REST API
 *   7. Fire-and-forget: trigger prescription-pdf
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function realtimeBroadcast(channel: string, event: string, payload: unknown) {
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey":        SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ messages: [{ topic: channel, event, payload }] }),
  });
  if (!res.ok) console.warn(`Realtime broadcast failed (${res.status}):`, await res.text());
}

function invokeFunction(name: string, body: unknown) {
  fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  }).catch(e => console.error(`invokeFunction(${name}) failed:`, e));
}

// ─────────────────────────────────────────────────────────────────────────────
// LOINC codes for vitals
// ─────────────────────────────────────────────────────────────────────────────

const LOINC: Record<string, { code: string; display: string; unit: string }> = {
  bp:     { code: "55284-4", display: "Blood pressure panel",     unit: "mm[Hg]" },
  pulse:  { code: "8867-4",  display: "Heart rate",               unit: "/min"   },
  temp:   { code: "8331-1",  display: "Oral temperature",         unit: "[degF]" },
  spo2:   { code: "2708-6",  display: "Oxygen saturation",        unit: "%"      },
  weight: { code: "29463-7", display: "Body weight",              unit: "kg"     },
  height: { code: "8302-2",  display: "Body height",              unit: "cm"     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Resource builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPatient(patient: Record<string, any>) {
  const birthYear = new Date().getFullYear() - (patient.age ?? 30);
  const resource: Record<string, any> = {
    resourceType: "Patient",
    id: `patient-${patient.id}`,
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
    },
    name: [{
      use:    "official",
      text:   patient.name,
      family: patient.name?.split(" ").slice(-1)[0] ?? patient.name,
      given:  [patient.name?.split(" ")[0] ?? patient.name],
    }],
    gender: patient.gender === "MALE" ? "male"
           : patient.gender === "FEMALE" ? "female"
           : "unknown",
    birthDate: `${birthYear}-01-01`,
  };

  if (patient.abha_id) {
    resource.identifier = [{
      type: {
        coding: [{
          system:  "http://terminology.hl7.org/CodeSystem/v2-0203",
          code:    "MR",
          display: "Medical Record Number",
        }],
      },
      system: "https://healthid.ndhm.gov.in",
      value:  patient.abha_id,
    }];
  }

  if (patient.mobile) {
    resource.telecom = [{
      system: "phone",
      value:  patient.mobile,
      use:    "mobile",
    }];
  }

  return resource;
}

function buildEncounter(
  session: Record<string, any>,
  doctor: Record<string, any>,
  patientRef: string,
) {
  return {
    resourceType: "Encounter",
    id: `encounter-${session.id}`,
    status: "finished",
    class: {
      system:  "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code:    "AMB",
      display: "ambulatory",
    },
    type: [{
      coding: [{
        system:  "http://snomed.info/sct",
        code:    "11429006",
        display: "Consultation",
      }],
    }],
    subject: { reference: patientRef },
    participant: [{
      type: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
          code:   "ATND",
        }],
      }],
      individual: {
        display: `Dr. ${doctor.name}`,
      },
    }],
    period: {
      start: session.started_at,
      end:   session.ended_at ?? new Date().toISOString(),
    },
    serviceProvider: {
      display: doctor.clinic_name ?? "Clinic",
    },
    location: [{
      location: { display: doctor.city ?? "India" },
    }],
  };
}

function buildObservations(
  vitals: Record<string, any>,
  patientRef: string,
  encounterRef: string,
  now: string,
): Record<string, any>[] {
  const observations: Record<string, any>[] = [];

  for (const [key, value] of Object.entries(vitals)) {
    if (value === null || value === undefined || value === "") continue;
    const loinc = LOINC[key];
    if (!loinc) continue;

    if (key === "bp") {
      // Blood pressure needs two components
      const parts = String(value).split("/");
      if (parts.length !== 2) continue;

      observations.push({
        resourceType: "Observation",
        id: `obs-bp-${Date.now()}`,
        status: "final",
        category: [{
          coding: [{
            system:  "http://terminology.hl7.org/CodeSystem/observation-category",
            code:    "vital-signs",
            display: "Vital Signs",
          }],
        }],
        code: {
          coding: [{
            system:  "http://loinc.org",
            code:    loinc.code,
            display: loinc.display,
          }],
          text: "Blood Pressure",
        },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        effectiveDateTime: now,
        component: [
          {
            code: {
              coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }],
            },
            valueQuantity: {
              value:  parseInt(parts[0]),
              unit:   "mmHg",
              system: "http://unitsofmeasure.org",
              code:   "mm[Hg]",
            },
          },
          {
            code: {
              coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }],
            },
            valueQuantity: {
              value:  parseInt(parts[1]),
              unit:   "mmHg",
              system: "http://unitsofmeasure.org",
              code:   "mm[Hg]",
            },
          },
        ],
      });
    } else {
      observations.push({
        resourceType: "Observation",
        id: `obs-${key}-${Date.now()}`,
        status: "final",
        category: [{
          coding: [{
            system:  "http://terminology.hl7.org/CodeSystem/observation-category",
            code:    "vital-signs",
            display: "Vital Signs",
          }],
        }],
        code: {
          coding: [{
            system:  "http://loinc.org",
            code:    loinc.code,
            display: loinc.display,
          }],
        },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        effectiveDateTime: now,
        valueQuantity: {
          value:  typeof value === "number" ? value : parseFloat(String(value)),
          unit:   loinc.unit,
          system: "http://unitsofmeasure.org",
          code:   loinc.unit,
        },
      });
    }
  }

  return observations;
}

function buildConditions(
  icd10Codes: Array<{ code: string; description: string }>,
  patientRef: string,
  encounterRef: string,
  now: string,
): Record<string, any>[] {
  return icd10Codes.map((c, i) => ({
    resourceType: "Condition",
    id: `condition-${i}-${Date.now()}`,
    clinicalStatus: {
      coding: [{
        system:  "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code:    "active",
        display: "Active",
      }],
    },
    verificationStatus: {
      coding: [{
        system:  "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code:    "provisional",
        display: "Provisional",
      }],
    },
    code: {
      coding: [{
        system:  "http://hl7.org/fhir/sid/icd-10",
        code:    c.code,
        display: c.description,
      }],
      text: c.description,
    },
    subject:      { reference: patientRef },
    encounter:    { reference: encounterRef },
    recordedDate: now.split("T")[0],
  }));
}

function buildMedicationRequests(
  medications: Array<{
    name: string; dosage: string; frequency: string; duration: string; notes?: string;
  }>,
  patientRef: string,
  encounterRef: string,
  now: string,
): Record<string, any>[] {
  return medications.map((med, i) => ({
    resourceType: "MedicationRequest",
    id: `medrx-${i}-${Date.now()}`,
    status:     "active",
    intent:     "order",
    medicationCodeableConcept: {
      text: `${med.name} ${med.dosage}`.trim(),
    },
    subject:    { reference: patientRef },
    encounter:  { reference: encounterRef },
    authoredOn: now,
    dosageInstruction: [{
      text: [med.dosage, med.frequency, `for ${med.duration}`, med.notes]
        .filter(Boolean).join(" — "),
      timing: {
        code: { text: med.frequency },
      },
      route: {
        coding: [{
          system:  "http://snomed.info/sct",
          code:    "26643006",
          display: "Oral route",
        }],
      },
    }],
    dispenseRequest: {
      validityPeriod: {
        start: now.split("T")[0],
      },
    },
  }));
}

function buildCarePlan(
  plan: string,
  followUpDays: number | null,
  patientRef: string,
  encounterRef: string,
  now: string,
): Record<string, any> | null {
  if (!plan && !followUpDays) return null;

  const carePlan: Record<string, any> = {
    resourceType: "CarePlan",
    id: `careplan-${Date.now()}`,
    status:  "active",
    intent:  "plan",
    title:   "Consultation Care Plan",
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    period:  { start: now.split("T")[0] },
    activity: [],
  };

  if (plan) carePlan.description = plan;

  if (followUpDays) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + followUpDays);
    carePlan.period.end = followUpDate.toISOString().split("T")[0];
    carePlan.activity.push({
      detail: {
        kind:         "Appointment",
        description:  `Follow-up in ${followUpDays} days`,
        status:       "scheduled",
        scheduledString: `In ${followUpDays} days`,
      },
    });
  }

  return carePlan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const { session_id, soap_note_id } = await req.json();
    if (!session_id)   return json({ error: "session_id is required" }, 400);
    if (!soap_note_id) return json({ error: "soap_note_id is required" }, 400);

    console.log(`fhir-bundle: starting for session ${session_id}`);

    // ── Fetch all required data in parallel ───────────────────────────────────
    const [
      { data: session, error: sessionErr },
      { data: soapNote, error: soapErr },
    ] = await Promise.all([
      adminClient
        .from("sessions")
        .select("*, patients(*)")
        .eq("id", session_id)
        .single(),
      adminClient
        .from("soap_notes")
        .select("*")
        .eq("id", soap_note_id)
        .single(),
    ]);

    if (sessionErr || !session) {
      return json({ error: "Session not found" }, 404);
    }
    if (soapErr || !soapNote) {
      return json({ error: "SOAP note not found" }, 404);
    }

    const { data: doctor } = await adminClient
      .from("doctors")
      .select("*")
      .eq("id", session.doctor_id)
      .single();

    if (!doctor) return json({ error: "Doctor not found" }, 404);

    const patient = session.patients as Record<string, any>;
    const now     = new Date().toISOString();

    // ── Build resources ───────────────────────────────────────────────────────
    const patientResource   = buildPatient(patient);
    const encounterResource = buildEncounter(session, doctor, `Patient/${patientResource.id}`);
    const observations      = buildObservations(
      soapNote.vitals ?? {},
      `Patient/${patientResource.id}`,
      `Encounter/${encounterResource.id}`,
      now,
    );
    const conditions = buildConditions(
      soapNote.icd10_codes ?? [],
      `Patient/${patientResource.id}`,
      `Encounter/${encounterResource.id}`,
      now,
    );
    const medicationRequests = buildMedicationRequests(
      soapNote.medications ?? [],
      `Patient/${patientResource.id}`,
      `Encounter/${encounterResource.id}`,
      now,
    );
    const carePlan = buildCarePlan(
      soapNote.plan ?? "",
      soapNote.follow_up_days ?? null,
      `Patient/${patientResource.id}`,
      `Encounter/${encounterResource.id}`,
      now,
    );

    const allResources = [
      patientResource,
      encounterResource,
      ...observations,
      ...conditions,
      ...medicationRequests,
      ...(carePlan ? [carePlan] : []),
    ];

    // ── Assemble Bundle ───────────────────────────────────────────────────────
    const bundle = {
      resourceType: "Bundle",
      id:           `bundle-${session_id}`,
      meta: {
        lastUpdated: now,
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"],
      },
      type:      "transaction",
      timestamp: now,
      entry: allResources.map(resource => ({
        fullUrl:  `urn:uuid:${resource.id}`,
        resource,
        request: {
          method: "PUT",
          url:    `${resource.resourceType}/${resource.id}`,
        },
      })),
    };

    const resourceTypes = [...new Set(allResources.map(r => r.resourceType))];

    console.log(`fhir-bundle: assembled ${allResources.length} resources (${resourceTypes.join(", ")})`);

    // ── Upload to Storage ─────────────────────────────────────────────────────
    const storagePath   = `fhir/${session.doctor_id}/${session_id}.json`;
    const bundleJson    = JSON.stringify(bundle, null, 2);

    const { error: uploadErr } = await adminClient.storage
      .from("fhir")
      .upload(storagePath, bundleJson, {
        contentType: "application/fhir+json",
        upsert:      true,
      });

    if (uploadErr) {
      // Non-fatal — DB write is the source of truth
      console.warn("Storage upload failed:", uploadErr.message);
    }

    // ── Insert into fhir_bundles ──────────────────────────────────────────────
    const { data: bundleRow, error: insertErr } = await adminClient
      .from("fhir_bundles")
      .insert({
        session_id,
        bundle,
        resource_types: resourceTypes,
        storage_path:   storagePath,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique constraint — already exists (idempotent)
      if (insertErr.code === "23505") {
        console.warn("fhir_bundle already exists for session, skipping insert");
        const { data: existing } = await adminClient
          .from("fhir_bundles")
          .select("id, storage_path")
          .eq("session_id", session_id)
          .single();

        await realtimeBroadcast(
          `realtime:session:${session_id}`,
          "fhir_ready",
          { bundle_id: existing?.id, storage_path: existing?.storage_path },
        );
        return json({ bundle_id: existing?.id });
      }
      throw insertErr;
    }

    // ── Broadcast fhir_ready ──────────────────────────────────────────────────
    await realtimeBroadcast(
      `realtime:session:${session_id}`,
      "fhir_ready",
      { bundle_id: bundleRow.id, storage_path: storagePath },
    );

    // ── Trigger prescription PDF (fire-and-forget) ────────────────────────────
    invokeFunction("prescription-pdf", {
      session_id,
      soap_note_id,
    });

    console.log(`fhir-bundle: done — bundle_id ${bundleRow.id}`);
    return json({ bundle_id: bundleRow.id, resource_types: resourceTypes });

  } catch (e: any) {
    console.error("fhir-bundle unhandled error:", e);
    return json({ error: e.message ?? "Internal server error" }, 500);
  }
});
