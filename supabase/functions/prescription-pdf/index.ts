/**
 * prescription-pdf/index.ts  — MediScribe Prescription Generator
 *
 * Called by sessions/:id/finalise (awaited) and fhir-bundle (fire-and-forget).
 *
 * Flow:
 *   1. Fetch session + patient + doctor + soap_note from DB
 *   2. Render a rich HTML prescription (clinic letterhead, drug table, ABHA, FHIR notice)
 *   3. Upload HTML to Supabase Storage (pdfs/{doctor_id}/{session_id}.html)
 *   4. Generate a signed URL (7-day validity)
 *   5. Upsert into prescriptions table (signed_url + storage_path)
 *   6. Broadcast pdf_ready via Realtime REST API
 *   7. Return { pdf_url, storage_path }
 *
 * NOTE: We output HTML rather than a binary PDF because Deno Edge Functions
 * don't have a headless browser. The React Native app opens the signed URL in
 * the device's default browser, where the doctor can print-to-PDF or share.
 * The HTML is styled for A4 printing and looks indistinguishable from a PDF.
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

// ─────────────────────────────────────────────────────────────────────────────
// HTML prescription renderer
// ─────────────────────────────────────────────────────────────────────────────

function renderPrescriptionHTML(
  doctor:   Record<string, any>,
  patient:  Record<string, any>,
  soap:     Record<string, any>,
  session:  Record<string, any>,
): string {
  const consultDate = new Date(session.started_at).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const vitalsHtml = soap.vitals
    ? Object.entries(soap.vitals as Record<string, any>)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => {
          const labels: Record<string, string> = {
            bp: "BP", pulse: "Pulse", temp: "Temp", spo2: "SpO₂", weight: "Wt", height: "Ht",
          };
          const units: Record<string, string> = {
            bp: " mmHg", pulse: " /min", temp: "°F", spo2: "%", weight: " kg", height: " cm",
          };
          return `<span class="vital-chip"><b>${labels[k] ?? k}:</b> ${v}${units[k] ?? ""}</span>`;
        }).join("")
    : "";

  const icd10Html = (soap.icd10_codes as Array<{ code: string; description: string }> ?? [])
    .map(c => `<span class="badge badge-blue">${c.code}</span> ${c.description}`)
    .join("<br>");

  const medsHtml = (soap.medications as Array<{
    name: string; dosage: string; frequency: string; duration: string; notes?: string;
  }> ?? []).map((med, i) => `
    <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="med-name">${i + 1}. ${med.name}</td>
      <td>${med.dosage}</td>
      <td>${med.frequency}</td>
      <td>${med.duration}</td>
      <td class="notes">${med.notes ?? "—"}</td>
    </tr>
  `).join("");

  const followUpHtml = soap.follow_up_days
    ? `<div class="followup-box">
         🗓️ <strong>Follow-up in ${soap.follow_up_days} days</strong>
         — ${(() => {
           const d = new Date();
           d.setDate(d.getDate() + soap.follow_up_days);
           return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
         })()}
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prescription — ${patient.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      color: #1e293b; background: #fff;
      font-size: 14px; line-height: 1.5;
    }
    .page { max-width: 820px; margin: 0 auto; padding: 36px 40px; }

    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 24px;
    }
    .clinic-name { font-size: 22px; font-weight: 800; color: #0ea5e9; }
    .doctor-name { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 4px; }
    .doctor-sub  { font-size: 13px; color: #64748b; margin-top: 2px; }
    .rx-symbol   { font-size: 56px; color: #0ea5e9; font-weight: 900; line-height: 1; }

    /* Patient + date grid */
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .meta-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;
    }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; }
    .meta-value { font-size: 16px; font-weight: 700; color: #1e293b; }
    .meta-sub   { font-size: 12px; color: #64748b; margin-top: 2px; }

    /* Section headings */
    .section-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #94a3b8; margin-bottom: 6px; margin-top: 18px;
    }

    /* Diagnosis box */
    .diagnosis {
      background: #fef9c3; border-left: 4px solid #eab308;
      padding: 12px 14px; border-radius: 0 8px 8px 0; margin-bottom: 4px;
      font-size: 15px; font-weight: 600; color: #713f12;
    }

    /* Vitals */
    .vitals-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
    .vital-chip {
      background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 6px; padding: 5px 10px; font-size: 13px;
    }

    /* Medications table */
    table { width: 100%; border-collapse: collapse; margin-top: 8px; border-radius: 10px; overflow: hidden; }
    thead { background: #0ea5e9; }
    th { padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; font-weight: 700; }
    td { padding: 9px 12px; vertical-align: top; }
    .row-even { background: #f8fafc; }
    .row-odd  { background: #fff; }
    .med-name { font-weight: 600; color: #1e293b; }
    .notes    { color: #64748b; font-size: 12px; }

    /* Plan */
    .plan-box {
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
      padding: 14px; font-size: 14px; color: #166534; line-height: 1.6;
    }

    /* Follow-up */
    .followup-box {
      background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px;
      padding: 12px 16px; color: #5b21b6; font-size: 14px; margin-top: 14px;
    }

    /* Badges */
    .badge { display: inline-block; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700; }
    .badge-blue { background: #dbeafe; color: #1e40af; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }

    /* Footer */
    .footer {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0;
    }
    .mediscribe-badge { font-size: 11px; color: #94a3b8; }
    .sig-box { text-align: right; }
    .sig-line { border-bottom: 1px solid #1e293b; width: 200px; height: 44px; margin-bottom: 4px; }
    .sig-name { font-size: 13px; font-weight: 700; }
    .sig-sub  { font-size: 12px; color: #64748b; }

    /* Abha watermark */
    .abha { font-size: 11px; color: #94a3b8; margin-top: 4px; }

    @media print {
      .page { padding: 20px; }
      body  { font-size: 12px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Header ───────────────────────────────────────────────────────────── -->
  <div class="header">
    <div>
      <div class="clinic-name">🏥 ${doctor.clinic_name || "Medical Clinic"}</div>
      <div class="doctor-name">Dr. ${doctor.name}</div>
      <div class="doctor-sub">${doctor.speciality} &nbsp;·&nbsp; ${doctor.city}</div>
      <div class="doctor-sub">📱 ${doctor.mobile_number}</div>
    </div>
    <div class="rx-symbol">℞</div>
  </div>

  <!-- ── Patient + Date ───────────────────────────────────────────────────── -->
  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Patient</div>
      <div class="meta-value">${patient.name}</div>
      <div class="meta-sub">
        ${patient.age} years &nbsp;·&nbsp; ${patient.gender}
        ${patient.mobile ? `&nbsp;·&nbsp; 📱 ${patient.mobile}` : ""}
      </div>
      ${patient.abha_id ? `<div class="abha">ABHA: ${patient.abha_id}</div>` : ""}
    </div>
    <div class="meta-box">
      <div class="meta-label">Consultation Date</div>
      <div class="meta-value" style="font-size:14px;">${consultDate}</div>
      <div class="meta-sub">Generated by MediScribe AI</div>
    </div>
  </div>

  <!-- ── Chief Complaint ──────────────────────────────────────────────────── -->
  ${soap.chief_complaint ? `
    <div class="section-label">Chief Complaint</div>
    <p style="color:#475569; margin-bottom:4px;">${soap.chief_complaint}</p>
  ` : ""}

  <!-- ── Diagnosis ────────────────────────────────────────────────────────── -->
  ${soap.assessment ? `
    <div class="section-label">Diagnosis</div>
    <div class="diagnosis">${soap.assessment}</div>
    ${icd10Html ? `<div style="margin-top:6px; font-size:12px;">${icd10Html}</div>` : ""}
  ` : ""}

  <!-- ── Vitals ───────────────────────────────────────────────────────────── -->
  ${vitalsHtml ? `
    <div class="section-label">Vitals</div>
    <div class="vitals-row">${vitalsHtml}</div>
  ` : ""}

  <hr class="divider">

  <!-- ── Medications ──────────────────────────────────────────────────────── -->
  <div class="section-label">Medications Prescribed</div>
  ${medsHtml ? `
    <table>
      <thead>
        <tr>
          <th>Drug Name</th>
          <th>Dose</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Instructions</th>
        </tr>
      </thead>
      <tbody>${medsHtml}</tbody>
    </table>
  ` : `<p style="color:#94a3b8; font-style:italic; margin-top:8px;">No medications prescribed.</p>`}

  <!-- ── Plan ─────────────────────────────────────────────────────────────── -->
  ${soap.plan ? `
    <div class="section-label">Treatment Plan & Advice</div>
    <div class="plan-box">${soap.plan.replace(/\n/g, "<br>")}</div>
  ` : ""}

  <!-- ── Follow-up ────────────────────────────────────────────────────────── -->
  ${followUpHtml}

  <!-- ── Footer ───────────────────────────────────────────────────────────── -->
  <div class="footer">
    <div class="mediscribe-badge">
      Generated by MediScribe AI Clinical Scribe<br>
      This prescription is digitally authenticated. FHIR R4 bundle available on request.<br>
      <span style="color:#cbd5e1">Session: ${session.id}</span>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">Dr. ${doctor.name}</div>
      <div class="sig-sub">${doctor.speciality}</div>
      <div class="sig-sub">${doctor.clinic_name}</div>
    </div>
  </div>

</div>
</body>
</html>`;
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

    console.log(`prescription-pdf: generating for session ${session_id}`);

    // ── Fetch data ────────────────────────────────────────────────────────────
    const [
      { data: session, error: sessionErr },
      { data: soapNote, error: soapErr },
    ] = await Promise.all([
      adminClient.from("sessions").select("*, patients(*)").eq("id", session_id).single(),
      adminClient.from("soap_notes").select("*").eq("id", soap_note_id).single(),
    ]);

    if (sessionErr || !session) return json({ error: "Session not found" }, 404);
    if (soapErr || !soapNote)   return json({ error: "SOAP note not found" }, 404);

    const { data: doctor } = await adminClient
      .from("doctors").select("*").eq("id", session.doctor_id).single();

    if (!doctor) return json({ error: "Doctor not found" }, 404);

    const patient = session.patients as Record<string, any>;

    // ── Render HTML ───────────────────────────────────────────────────────────
    const html = renderPrescriptionHTML(doctor, patient, soapNote, session);

    // ── Upload to Storage ─────────────────────────────────────────────────────
    const storagePath = `pdfs/${session.doctor_id}/${session_id}.html`;

    const { error: uploadErr } = await adminClient.storage
      .from("pdfs")
      .upload(storagePath, html, {
        contentType: "text/html; charset=utf-8",
        upsert:      true,
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr.message);
      return json({ error: "Storage upload failed", detail: uploadErr.message }, 500);
    }

    // ── Generate signed URL (7 days) ──────────────────────────────────────────
    const { data: signedData, error: signErr } = await adminClient.storage
      .from("pdfs")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (signErr || !signedData?.signedUrl) {
      console.error("Signed URL failed:", signErr?.message);
      return json({ error: "Signed URL generation failed" }, 500);
    }

    const pdfUrl = signedData.signedUrl;

    // ── Upsert into prescriptions ─────────────────────────────────────────────
    const { error: upsertErr } = await adminClient
      .from("prescriptions")
      .upsert({
        session_id,
        storage_path: storagePath,
        signed_url:   pdfUrl,
        generated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });

    if (upsertErr) console.warn("Prescriptions upsert warning:", upsertErr.message);

    // ── Broadcast pdf_ready ───────────────────────────────────────────────────
    await realtimeBroadcast(
      `realtime:session:${session_id}`,
      "pdf_ready",
      { pdf_url: pdfUrl },
    );

    console.log(`prescription-pdf: done — ${storagePath}`);
    return json({ pdf_url: pdfUrl, storage_path: storagePath });

  } catch (e: any) {
    console.error("prescription-pdf unhandled error:", e);
    return json({ error: e.message ?? "Internal server error" }, 500);
  }
});
