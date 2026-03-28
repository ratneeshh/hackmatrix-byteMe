/**
 * analyse/index.ts  — MediScribe clinical NLP Edge Function
 *
 * Called by sessions/:id/end (server-to-server, fire-and-forget).
 *
 * Flow:
 *   1. Fetch all transcript chunks for the session (ordered by chunk_index)
 *   2. Build a structured clinical prompt for Groq LLaMA 3
 *   3. Parse the returned JSON into a SOAPNote shape
 *   4. INSERT into soap_notes table
 *   5. Broadcast analysis_complete via Realtime REST API
 *   6. Fire-and-forget: trigger fhir-bundle function
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY     = Deno.env.get("GROQ_API_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function realtimeBroadcast(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey":        SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      messages: [{ topic: channel, event, payload }],
    }),
  });
  if (!res.ok) {
    console.warn(`Realtime broadcast failed (${res.status}):`, await res.text());
  }
}

async function invokeFunction(name: string, body: unknown): Promise<void> {
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
// LLaMA 3 prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert clinical documentation AI trained on Indian healthcare.
Your task is to analyse a doctor-patient consultation transcript and produce a structured SOAP note.

RULES:
- Return ONLY a valid JSON object. No preamble, no explanation, no markdown fences.
- All fields are required. Use empty string "" or empty array [] if information is not mentioned.
- Extract information only from what is said — never invent clinical details.
- Medications: extract name, dosage, frequency, duration. Use Indian brand names if mentioned.
- ICD-10 codes: provide the most specific applicable code. Include at least one if any diagnosis is mentioned.
- Vitals: only include values explicitly mentioned (BP, pulse, temperature, SpO2, weight, height).
- follow_up_days: number of days until follow-up if mentioned, otherwise null.
- The transcript may contain Hinglish (Hindi + English mix). Handle both languages.

OUTPUT JSON SCHEMA (follow exactly):
{
  "chief_complaint": "string — presenting complaint in one sentence",
  "history": "string — history of presenting illness, past medical history, allergies",
  "examination": "string — clinical examination findings mentioned by the doctor",
  "assessment": "string — diagnosis or clinical impression",
  "icd10_codes": [
    { "code": "string", "description": "string" }
  ],
  "plan": "string — treatment plan, investigations ordered, referrals",
  "medications": [
    {
      "name": "string",
      "dosage": "string",
      "frequency": "string",
      "duration": "string",
      "notes": "string"
    }
  ],
  "vitals": {
    "bp": "string or null",
    "pulse": "number or null",
    "temp": "number or null",
    "spo2": "number or null",
    "weight": "number or null",
    "height": "number or null"
  },
  "follow_up_days": "number or null"
}

FEW-SHOT EXAMPLE:

TRANSCRIPT:
[DOCTOR] Kya problem hai aapko?
[PATIENT] Doctor, mujhe do din se bukhar hai. Sar mein bhi dard hai.
[DOCTOR] Temperature check kiya? Kitna tha?
[PATIENT] Haan, 101.5 tha kal raat.
[DOCTOR] Koi allergy nahi hai na? Diabetes ya BP ka history?
[PATIENT] Nahi doctor.
[DOCTOR] Okay, viral fever lag raha hai. Paracetamol 500mg likhta hoon, TDS teen din ke liye. Pani zyada piyo, rest karo. Teen din baad aana agar theek na ho.

OUTPUT:
{
  "chief_complaint": "Fever for 2 days with headache",
  "history": "Fever since 2 days, temperature 101.5°F last night. Associated headache. No known allergies. No history of diabetes or hypertension.",
  "examination": "No formal examination findings documented.",
  "assessment": "Viral fever with headache",
  "icd10_codes": [
    { "code": "B34.9", "description": "Viral infection, unspecified" },
    { "code": "R51", "description": "Headache" }
  ],
  "plan": "Rest and adequate oral hydration. Paracetamol for fever and pain. Review in 3 days if symptoms persist.",
  "medications": [
    {
      "name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "TDS (three times daily)",
      "duration": "3 days",
      "notes": "Take after food"
    }
  ],
  "vitals": {
    "bp": null,
    "pulse": null,
    "temp": 101.5,
    "spo2": null,
    "weight": null,
    "height": null
  },
  "follow_up_days": 3
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Call Groq LLaMA 3
// ─────────────────────────────────────────────────────────────────────────────

async function callLLaMA3(transcript: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       "llama3-70b-8192",
      temperature: 0.1,   // low temperature for structured clinical output
      max_tokens:  2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyse this doctor-patient consultation transcript and return the SOAP note JSON:\n\n${transcript}`,
        },
      ],
      // Ask the model to return JSON — helps with Llama 3's instruction following
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq LLaMA 3 failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const raw  = data.choices?.[0]?.message?.content ?? "";

  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`LLaMA 3 returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate + sanitise LLM output into a safe SOAPNote shape
// ─────────────────────────────────────────────────────────────────────────────

function sanitiseSOAP(raw: Record<string, unknown>) {
  const str  = (v: unknown) => (typeof v === "string" ? v : "");
  const arr  = (v: unknown) => (Array.isArray(v) ? v : []);
  const num  = (v: unknown) => (typeof v === "number" ? v : null);
  const obj  = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;

  const vitalsRaw = obj(raw.vitals);

  return {
    chief_complaint: str(raw.chief_complaint),
    history:         str(raw.history),
    examination:     str(raw.examination),
    assessment:      str(raw.assessment),
    plan:            str(raw.plan),
    follow_up_days:  num(raw.follow_up_days),

    icd10_codes: arr(raw.icd10_codes).map((c: unknown) => {
      const code = obj(c);
      return {
        code:        str(code.code),
        description: str(code.description),
      };
    }).filter(c => c.code),   // drop any empty entries

    medications: arr(raw.medications).map((m: unknown) => {
      const med = obj(m);
      return {
        name:      str(med.name),
        dosage:    str(med.dosage),
        frequency: str(med.frequency),
        duration:  str(med.duration),
        notes:     str(med.notes),
      };
    }).filter(m => m.name),   // drop any empty entries

    vitals: {
      bp:     typeof vitalsRaw.bp     === "string" ? vitalsRaw.bp : null,
      pulse:  num(vitalsRaw.pulse),
      temp:   num(vitalsRaw.temp),
      spo2:   num(vitalsRaw.spo2),
      weight: num(vitalsRaw.weight),
      height: num(vitalsRaw.height),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) return json({ error: "session_id is required" }, 400);

    console.log(`analyse: starting for session ${session_id}`);

    // ── 1. Fetch session ──────────────────────────────────────────────────────
    const { data: session, error: sessionErr } = await adminClient
      .from("sessions")
      .select("id, doctor_id, patient_id, started_at, ended_at, status")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return json({ error: "Session not found" }, 404);
    }

    // ── 2. Fetch all transcript chunks ────────────────────────────────────────
    const { data: chunks, error: chunksErr } = await adminClient
      .from("transcripts")
      .select("chunk_index, text, speaker_label, confidence")
      .eq("session_id", session_id)
      .order("chunk_index", { ascending: true });

    if (chunksErr) throw chunksErr;

    if (!chunks || chunks.length === 0) {
      // No transcript at all — create a minimal SOAP note rather than failing
      console.warn(`analyse: no transcript chunks found for session ${session_id}`);
    }

    // ── 3. Build transcript string ────────────────────────────────────────────
    const transcriptText = (chunks ?? [])
      .map(c => `[${c.speaker_label}] ${c.text}`)
      .join("\n");

    const fullTranscript = transcriptText || "[No transcript available — session may have been silent]";

    // ── 4. Call LLaMA 3 ───────────────────────────────────────────────────────
    console.log(`analyse: calling LLaMA 3 with ${(chunks ?? []).length} chunks…`);

    let soapRaw: Record<string, unknown>;
    try {
      soapRaw = await callLLaMA3(fullTranscript);
    } catch (llmErr: any) {
      console.error("LLaMA 3 error:", llmErr.message);

      // Broadcast error to frontend so it doesn't hang
      await realtimeBroadcast(
        `realtime:session:${session_id}`,
        "error",
        { code: "LLM_FAILED", message: "AI analysis failed. Please review transcript manually." },
      );

      // Update session status to FAILED
      await adminClient
        .from("sessions")
        .update({ status: "FAILED" })
        .eq("id", session_id);

      return json({ error: llmErr.message }, 502);
    }

    // ── 5. Sanitise output ────────────────────────────────────────────────────
    const soap = sanitiseSOAP(soapRaw);
    console.log(`analyse: SOAP extracted — assessment: "${soap.assessment}"`);

    // ── 6. Insert soap_notes row ──────────────────────────────────────────────
    const { data: soapNote, error: insertErr } = await adminClient
      .from("soap_notes")
      .insert({
        session_id,
        ...soap,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique constraint violation — analysis already ran (idempotent)
      if (insertErr.code === "23505") {
        console.warn(`analyse: soap_note already exists for session ${session_id}`);
        const { data: existing } = await adminClient
          .from("soap_notes")
          .select("id")
          .eq("session_id", session_id)
          .single();

        await realtimeBroadcast(
          `realtime:session:${session_id}`,
          "analysis_complete",
          { soap_note_id: existing?.id },
        );
        return json({ soap_note_id: existing?.id });
      }
      throw insertErr;
    }

    // ── 7. Update session status → REVIEW ─────────────────────────────────────
    await adminClient
      .from("sessions")
      .update({ status: "REVIEW" })
      .eq("id", session_id);

    // ── 8. Broadcast analysis_complete → frontend navigates to review screen ──
    await realtimeBroadcast(
      `realtime:session:${session_id}`,
      "analysis_complete",
      { soap_note_id: soapNote.id },
    );

    console.log(`analyse: complete — soap_note id ${soapNote.id}`);

    // ── 9. Fire-and-forget: trigger FHIR bundle generation ───────────────────
    invokeFunction("fhir-bundle", {
      session_id,
      soap_note_id: soapNote.id,
    });

    return json({ soap_note_id: soapNote.id });

  } catch (e: any) {
    console.error("analyse unhandled error:", e);
    return json({ error: e.message ?? "Internal server error" }, 500);
  }
});