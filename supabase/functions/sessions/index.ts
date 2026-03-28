/**
 * sessions/index.ts  — MediScribe session lifecycle Edge Function
 *
 * Routes (all require Authorization: Bearer <supabase_jwt>):
 *
 *   POST   /sessions/start                →  startSession
 *   POST   /sessions/:id/chunk            →  receiveChunk   (delegates to /transcribe)
 *   POST   /sessions/:id/end              →  endSession     (triggers /analyse)
 *   GET    /sessions/:id                  →  getSession
 *   GET    /sessions                      →  listSessions
 *   PATCH  /sessions/:id/soap             →  patchSOAP
 *   POST   /sessions/:id/finalise         →  finaliseSession (triggers /prescription-pdf)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Service-role client — bypasses RLS. Only used AFTER we have verified the JWT. */
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Extract and verify the doctor's JWT from the Authorization header.
 *  Returns { doctorId, userClient } on success, throws on failure. */
async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing or malformed Authorization header"), { status: 401 });
  }

  const jwt = authHeader.slice(7);

  // Verify the token by fetching the user — getUser calls Supabase Auth internally
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw Object.assign(new Error("Invalid or expired token"), { status: 401 });
  }

  return { doctorId: user.id, userClient };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Call another Edge Function using the service role (server-to-server). */
async function invokeFunction(name: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /sessions/start
 * Body: { patient_id: string, language: string }
 * Returns: { session_id, realtime_channel }
 */
async function startSession(req: Request) {
  const { doctorId } = await authenticate(req);

  const body = await req.json();
  const { patient_id, language } = body;

  if (!patient_id) return err("patient_id is required");

  // Verify the patient belongs to this doctor (RLS check via admin + explicit filter)
  const { data: patient, error: patientErr } = await adminClient
    .from("patients")
    .select("id")
    .eq("id", patient_id)
    .eq("doctor_id", doctorId)
    .single();

  if (patientErr || !patient) {
    return err("Patient not found or does not belong to this doctor", 403);
  }

  const { data: session, error } = await adminClient
    .from("sessions")
    .insert({
      doctor_id:         doctorId,
      patient_id,
      status:            "RECORDING",
      started_at:        new Date().toISOString(),
      language_detected: language ?? "en-hi",
    })
    .select("id")
    .single();

  if (error) throw error;

  return json({
    session_id:       session.id,
    realtime_channel: `session:${session.id}`,
  });
}

/**
 * POST /sessions/:id/chunk
 * Body: { audio_b64: string, chunk_index: number }
 * Delegates to /transcribe Edge Function and returns its response.
 */
async function receiveChunk(req: Request, sessionId: string) {
  const { doctorId } = await authenticate(req);

  // Verify session ownership
  const { data: session, error: sessionErr } = await adminClient
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("doctor_id", doctorId)
    .single();

  if (sessionErr || !session) return err("Session not found", 404);
  if (session.status !== "RECORDING") return err("Session is not in RECORDING state", 409);

  const body = await req.json();
  const { audio_b64, chunk_index } = body;

  if (!audio_b64)              return err("audio_b64 is required");
  if (chunk_index === undefined) return err("chunk_index is required");

  // Delegate to the transcribe function (which calls Groq Whisper)
  const transcribeRes = await invokeFunction("transcribe", {
    session_id:  sessionId,
    chunk_index,
    audio_b64,
  });

  const transcribeData = await transcribeRes.json();

  if (!transcribeRes.ok) {
    return json({ error: transcribeData.error ?? "Transcription failed" }, transcribeRes.status);
  }

  return json(transcribeData);
}

/**
 * POST /sessions/:id/end
 * Body: {}
 * Sets status → PROCESSING, triggers /analyse asynchronously.
 * Returns: { status: "PROCESSING", estimated_seconds: number }
 */
async function endSession(req: Request, sessionId: string) {
  const { doctorId } = await authenticate(req);

  const { data: session, error: sessionErr } = await adminClient
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("doctor_id", doctorId)
    .single();

  if (sessionErr || !session) return err("Session not found", 404);
  if (session.status === "COMPLETE") return err("Session already complete", 409);

  // Mark as PROCESSING + set ended_at (duration_seconds is computed automatically)
  const { error: updateErr } = await adminClient
    .from("sessions")
    .update({
      status:    "PROCESSING",
      ended_at:  new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateErr) throw updateErr;

  // Fire-and-forget: trigger NLP analysis (don't await — client gets 200 immediately)
  invokeFunction("analyse", { session_id: sessionId }).catch((e) => {
    console.error("analyse trigger failed:", e);
  });

  return json({ status: "PROCESSING", estimated_seconds: 8 });
}

/**
 * GET /sessions/:id
 * Returns the full session with transcripts, soap_note, fhir_bundle.
 */
async function getSession(req: Request, sessionId: string) {
  const { doctorId } = await authenticate(req);

  // Session
  const { data: session, error: sessionErr } = await adminClient
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("doctor_id", doctorId)
    .single();

  if (sessionErr || !session) return err("Session not found", 404);

  // Transcripts (ordered by chunk_index)
  const { data: transcripts } = await adminClient
    .from("transcripts")
    .select("*")
    .eq("session_id", sessionId)
    .order("chunk_index", { ascending: true });

  // SOAP note (may not exist yet)
  const { data: soap_note } = await adminClient
    .from("soap_notes")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  // FHIR bundle (may not exist yet)
  const { data: fhir_bundle } = await adminClient
    .from("fhir_bundles")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  return json({ session, transcripts: transcripts ?? [], soap_note, fhir_bundle });
}

/**
 * GET /sessions  (no :id in path)
 * Query params: page, limit, patient_id (all optional)
 * Returns paginated SessionSummary list.
 */
async function listSessions(req: Request) {
  const { doctorId } = await authenticate(req);

  const url   = new URL(req.url);
  const page  = parseInt(url.searchParams.get("page")  ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const patientId = url.searchParams.get("patient_id");

  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let query = adminClient
    .from("sessions")
    .select(`
      id,
      status,
      started_at,
      duration_seconds,
      patient_id,
      patients ( name ),
      soap_notes ( icd10_codes )
    `, { count: "exact" })
    .eq("doctor_id", doctorId)
    .order("started_at", { ascending: false })
    .range(from, to);

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, count, error } = await query;
  if (error) throw error;

  // Shape into SessionSummary[]
  const sessions = (data ?? []).map((row: any) => ({
    id:               row.id,
    status:           row.status,
    started_at:       row.started_at,
    duration_seconds: row.duration_seconds ?? 0,
    patient_name:     row.patients?.name ?? "Unknown",
    top_diagnosis:    row.soap_notes?.icd10_codes?.[0]?.description ?? null,
  }));

  return json({ data: sessions, total: count ?? 0, page });
}

/**
 * PATCH /sessions/:id/soap
 * Body: { doctor_edits: Record<string, any> }
 * Merges doctor edits into soap_notes.doctor_edits.
 */
async function patchSOAP(req: Request, sessionId: string) {
  const { doctorId } = await authenticate(req);

  // Verify session ownership
  const { data: session, error: sessionErr } = await adminClient
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("doctor_id", doctorId)
    .single();

  if (sessionErr || !session) return err("Session not found", 404);

  const body = await req.json();
  const { doctor_edits } = body;

  if (!doctor_edits || typeof doctor_edits !== "object") {
    return err("doctor_edits object is required");
  }

  // Fetch existing edits and merge
  const { data: existing } = await adminClient
    .from("soap_notes")
    .select("doctor_edits")
    .eq("session_id", sessionId)
    .maybeSingle();

  const merged = { ...(existing?.doctor_edits ?? {}), ...doctor_edits };

  const { error: updateErr } = await adminClient
    .from("soap_notes")
    .update({ doctor_edits: merged })
    .eq("session_id", sessionId);

  if (updateErr) throw updateErr;

  return json({ success: true });
}

/**
 * POST /sessions/:id/finalise
 * Body: {}
 * Sets status → COMPLETE, triggers /prescription-pdf, returns pdf_url + fhir_path.
 */
async function finaliseSession(req: Request, sessionId: string) {
  const { doctorId } = await authenticate(req);

  const { data: session, error: sessionErr } = await adminClient
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("doctor_id", doctorId)
    .single();

  if (sessionErr || !session) return err("Session not found", 404);
  if (session.status === "COMPLETE") {
    // Idempotent — return existing PDF URL if already finalised
    const { data: prescription } = await adminClient
      .from("prescriptions")
      .select("signed_url, storage_path")
      .eq("session_id", sessionId)
      .maybeSingle();

    const { data: fhirBundle } = await adminClient
      .from("fhir_bundles")
      .select("storage_path")
      .eq("session_id", sessionId)
      .maybeSingle();

    return json({
      pdf_url:    prescription?.signed_url   ?? null,
      fhir_path:  fhirBundle?.storage_path   ?? null,
    });
  }

  // Mark finalised_at on soap_note
  await adminClient
    .from("soap_notes")
    .update({ finalised_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  // Set session COMPLETE
  const { error: completeErr } = await adminClient
    .from("sessions")
    .update({ status: "COMPLETE" })
    .eq("id", sessionId);

  if (completeErr) throw completeErr;

  // Trigger PDF generation (await this one — frontend wants the URL immediately)
  let pdfUrl: string | null = null;
  try {
    const pdfRes  = await invokeFunction("prescription-pdf", { session_id: sessionId });
    const pdfData = await pdfRes.json();
    pdfUrl = pdfData.pdf_url ?? null;
  } catch (e) {
    console.error("prescription-pdf failed:", e);
    // Non-fatal — session is still COMPLETE, PDF can be regenerated
  }

  // Fetch FHIR path for the response
  const { data: fhirBundle } = await adminClient
    .from("fhir_bundles")
    .select("storage_path")
    .eq("session_id", sessionId)
    .maybeSingle();

  return json({
    pdf_url:   pdfUrl,
    fhir_path: fhirBundle?.storage_path ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const url    = new URL(req.url);
    // Path inside the function: /sessions, /sessions/start, /sessions/:id, /sessions/:id/chunk …
    // Supabase strips /functions/v1/ so pathname starts with /sessions
    const parts  = url.pathname.replace(/^\/sessions\/?/, "").split("/").filter(Boolean);
    // parts[0] = "start" | "<uuid>" | ""
    // parts[1] = "chunk" | "end" | "soap" | "finalise" | undefined

    const method = req.method;

    // POST /sessions/start
    if (method === "POST" && parts[0] === "start") {
      return await startSession(req);
    }

    // GET /sessions  (list)
    if (method === "GET" && parts.length === 0) {
      return await listSessions(req);
    }

    // Routes with a session ID
    const sessionId = parts[0];
    const action    = parts[1];

    if (!sessionId) return err("Invalid route", 404);

    // POST /sessions/:id/chunk
    if (method === "POST" && action === "chunk") {
      return await receiveChunk(req, sessionId);
    }

    // POST /sessions/:id/end
    if (method === "POST" && action === "end") {
      return await endSession(req, sessionId);
    }

    // GET /sessions/:id
    if (method === "GET" && !action) {
      return await getSession(req, sessionId);
    }

    // PATCH /sessions/:id/soap
    if (method === "PATCH" && action === "soap") {
      return await patchSOAP(req, sessionId);
    }

    // POST /sessions/:id/finalise
    if (method === "POST" && action === "finalise") {
      return await finaliseSession(req, sessionId);
    }

    return err("Route not found", 404);

  } catch (e: any) {
    console.error("Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal server error" }),
      { status: e.status ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }
});