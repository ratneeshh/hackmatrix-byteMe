/**
 * transcribe/index.ts  — MediScribe audio transcription Edge Function
 *
 * Called by sessions/:id/chunk (server-to-server, service role).
 * Also callable directly from the mobile app with a doctor JWT.
 *
 * Flow:
 *   1. Decode base64 audio → m4a blob
 *   2. POST to Groq Whisper API (whisper-large-v3) as multipart/form-data
 *   3. Basic speaker diarisation via turn-taking heuristic
 *   4. INSERT transcript row into Postgres
 *   5. Broadcast transcript_chunk via Supabase Realtime REST API
 *   6. Return { text, speaker_label, chunk_index, confidence }
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

/**
 * Groq Whisper transcription.
 * Accepts base64-encoded m4a audio, returns { text, confidence }.
 * Groq whisper-large-v3 supports Hindi + English natively.
 */
async function callGroqWhisper(
  audio_b64: string,
  language: string,
): Promise<{ text: string; confidence: number }> {
  // Decode base64 → raw bytes
  const binaryStr = atob(audio_b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Build multipart form — Groq expects the file as a form field named "file"
  const formData = new FormData();
  const audioBlob = new Blob([bytes], { type: "audio/m4a" });
  formData.append("file", audioBlob, "chunk.m4a");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json"); // gives us word-level confidence
  formData.append("temperature", "0");

  // Language hint — helps Whisper for Hinglish code-switching
  // "hi" triggers Hindi+English mixed mode; "en" forces English only
  if (language === "en") {
    formData.append("language", "en");
  }
  // For "hi" or "en-hi" we omit the language param — Whisper auto-detects
  // and handles code-switching better without a forced language

  const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      // DO NOT set Content-Type — fetch sets it automatically with the boundary
    },
    body: formData,
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error("Groq Whisper error:", errText);
    throw new Error(`Groq Whisper failed (${groqRes.status}): ${errText}`);
  }

  const groqData = await groqRes.json();

  // verbose_json returns { text, segments: [{ avg_logprob, ... }] }
  const text = (groqData.text ?? "").trim();

  // Derive confidence from avg_logprob of first segment (logprob is negative;
  // closer to 0 = higher confidence). Clamp to [0, 1].
  const segments = groqData.segments ?? [];
  let confidence = 0.85; // default if no segments
  if (segments.length > 0) {
    const avgLogprob = segments[0].avg_logprob ?? -0.5;
    // Map logprob: 0.0 → 1.0 confidence, -1.0 → ~0.37, -2.0 → ~0.14
    confidence = Math.min(1, Math.max(0, Math.exp(avgLogprob)));
  }

  return { text, confidence };
}

/**
 * Simple turn-taking speaker diarisation.
 * Groq Whisper doesn't do speaker diarisation natively, so we use a heuristic:
 *   - Even chunks (0, 2, 4 …) are DOCTOR (doctor speaks first, starts the consult)
 *   - Odd chunks  (1, 3, 5 …) are PATIENT
 *   - If the text contains strong clinical command words, force DOCTOR
 *   - If confidence < 0.5 or text is very short, mark UNKNOWN
 *
 * This is imperfect but good enough for the demo. A production system would
 * use a proper diarisation model (e.g. pyannote) as a post-processing step.
 */
function inferSpeakerLabel(
  text: string,
  chunk_index: number,
  confidence: number,
): "DOCTOR" | "PATIENT" | "UNKNOWN" {
  if (!text || text.length < 3 || confidence < 0.4) return "UNKNOWN";

  const lower = text.toLowerCase();

  // Strong doctor indicators — clinical commands / prescriptions
  const doctorKeywords = [
    "prescrib", "tablet", "mg ", "dose", "twice", "thrice", "daily",
    "examine", "let me", "blood pressure", "temperature", "refer",
    "test karo", "dawai", "check karta", "likhta hoon", "diagnosis",
    "symptoms", "history", "allergies", "any pain", "press karta",
  ];

  // Strong patient indicators
  const patientKeywords = [
    "doctor ", "mujhe", "meri", "mera", "ho raha", "dard", "bukhar",
    "i have", "i feel", "since ", "din se", "raat se", "subah se",
    "nahi hai", "pehle", "past", "months ago",
  ];

  const doctorScore  = doctorKeywords.filter(k => lower.includes(k)).length;
  const patientScore = patientKeywords.filter(k => lower.includes(k)).length;

  if (doctorScore > patientScore) return "DOCTOR";
  if (patientScore > doctorScore) return "PATIENT";

  // Fallback: alternating turns
  return chunk_index % 2 === 0 ? "DOCTOR" : "PATIENT";
}

/**
 * Broadcast an event to a Supabase Realtime channel using the REST API.
 * The JS client's .channel().send() uses WebSocket and is unreliable in
 * Deno Edge Function context. The REST broadcast endpoint is the correct
 * server-side approach.
 */
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
      messages: [
        {
          topic:   channel,   // e.g. "realtime:session:abc-123"
          event,              // e.g. "transcript_chunk"
          payload,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Non-fatal — log and continue. DB write is the source of truth.
    console.warn(`Realtime broadcast failed (${res.status}):`, text);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const { session_id, chunk_index, audio_b64 } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!session_id)              return json({ error: "session_id is required" }, 400);
    if (chunk_index === undefined) return json({ error: "chunk_index is required" }, 400);
    if (!audio_b64)               return json({ error: "audio_b64 is required" }, 400);

    // ── Fetch session for language hint ───────────────────────────────────────
    const { data: session, error: sessionErr } = await adminClient
      .from("sessions")
      .select("language_detected, status")
      .eq("id", session_id)
      .single();

    if (sessionErr || !session) {
      return json({ error: "Session not found" }, 404);
    }

    if (session.status !== "RECORDING") {
      return json({ error: "Session is not in RECORDING state" }, 409);
    }

    // ── Call Groq Whisper ─────────────────────────────────────────────────────
    console.log(`Transcribing chunk ${chunk_index} for session ${session_id}…`);

    let text: string;
    let confidence: number;

    try {
      ({ text, confidence } = await callGroqWhisper(
        audio_b64,
        session.language_detected ?? "en-hi",
      ));
    } catch (whisperErr: any) {
      console.error("Whisper call failed:", whisperErr.message);
      return json({ error: "Transcription failed", details: whisperErr.message }, 502);
    }

    // Skip empty transcriptions (silence, background noise)
    if (!text) {
      console.log(`Chunk ${chunk_index}: empty transcription (silence), skipping DB insert`);
      return json({ text: "", speaker_label: "UNKNOWN", chunk_index, confidence: 0 });
    }

    // ── Speaker diarisation ───────────────────────────────────────────────────
    const speaker_label = inferSpeakerLabel(text, chunk_index, confidence);

    // ── Insert transcript row ─────────────────────────────────────────────────
    const { error: insertErr } = await adminClient
      .from("transcripts")
      .insert({
        session_id,
        chunk_index,
        text,
        speaker_label,
        confidence,
      });

    if (insertErr) {
      // Duplicate chunk_index (unique constraint) — idempotent, not fatal
      if (insertErr.code === "23505") {
        console.warn(`Chunk ${chunk_index} already exists, skipping insert`);
      } else {
        console.error("DB insert error:", insertErr);
        return json({ error: "Database insert failed", details: insertErr.message }, 500);
      }
    }

    // ── Realtime broadcast ────────────────────────────────────────────────────
    // Channel name must match what the frontend subscribes to:
    // supabase.channel(`session:${sessionId}`) → topic = "realtime:session:<id>"
    await realtimeBroadcast(
      `realtime:session:${session_id}`,
      "transcript_chunk",
      { text, speaker_label, chunk_index, confidence },
    );

    // ── Response ──────────────────────────────────────────────────────────────
    console.log(`Chunk ${chunk_index} transcribed: "${text.slice(0, 60)}…" [${speaker_label}]`);

    return json({ text, speaker_label, chunk_index, confidence });

  } catch (e: any) {
    console.error("transcribe unhandled error:", e);
    return json({ error: e.message ?? "Internal server error" }, 500);
  }
});