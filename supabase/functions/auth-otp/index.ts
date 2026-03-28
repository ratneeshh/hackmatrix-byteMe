/**
 * auth-otp/index.ts  — MediScribe PIN management Edge Function
 *
 * Routes (all require Authorization: Bearer <supabase_jwt>):
 *
 *   POST /auth-otp/set-pin     →  bcrypt-hash and store the PIN
 *   POST /auth-otp/verify-pin  →  compare submitted PIN against stored hash
 *
 * Why a separate Edge Function for this?
 * The bcrypt secret never leaves the server. The frontend never sees the hash.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Extract doctor ID from the JWT in Authorization header. */
async function getDoctorId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing Authorization header"), { status: 401 });
  }

  const jwt = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw Object.assign(new Error("Invalid or expired token"), { status: 401 });
  }

  return user.id;
}

function validatePin(pin: string): string | null {
  if (!pin)                       return "PIN is required";
  if (typeof pin !== "string")    return "PIN must be a string";
  if (!/^\d{6}$/.test(pin))      return "PIN must be exactly 6 digits";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth-otp/set-pin
// Body: { pin: string }
// Hashes the PIN with bcrypt (cost 10) and stores it in doctors.pin_hash.
// ─────────────────────────────────────────────────────────────────────────────
async function setPin(req: Request) {
  const doctorId = await getDoctorId(req);

  const body = await req.json();
  const { pin } = body;

  const validationError = validatePin(pin);
  if (validationError) return json({ error: validationError }, 400);

  // bcrypt hash — cost 10 is the standard for PINs (fast enough for UX, slow for brute-force)
  const pin_hash = await bcrypt.hash(pin);

  const { error } = await adminClient
    .from("doctors")
    .update({ pin_hash })
    .eq("id", doctorId);

  if (error) {
    console.error("set-pin DB error:", error);
    return json({ error: "Failed to save PIN" }, 500);
  }

  return json({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth-otp/verify-pin
// Body: { pin: string }
// Returns { valid: true } or 401.
// ─────────────────────────────────────────────────────────────────────────────
async function verifyPin(req: Request) {
  const doctorId = await getDoctorId(req);

  const body = await req.json();
  const { pin } = body;

  const validationError = validatePin(pin);
  if (validationError) return json({ error: validationError }, 400);

  // Fetch the stored hash
  const { data: doctor, error: fetchErr } = await adminClient
    .from("doctors")
    .select("pin_hash")
    .eq("id", doctorId)
    .single();

  if (fetchErr || !doctor) {
    return json({ error: "Doctor not found" }, 404);
  }

  if (!doctor.pin_hash) {
    // Doctor exists but has never set a PIN (shouldn't happen in normal flow)
    return json({ error: "PIN not set. Please set your PIN first." }, 400);
  }

  // Constant-time compare via bcrypt
  const valid = await bcrypt.compare(pin, doctor.pin_hash);

  if (!valid) {
    // 401 so the frontend can distinguish "wrong PIN" from other errors
    return json({ valid: false }, 401);
  }

  // Update last_active_at on successful PIN verification
  await adminClient
    .from("doctors")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", doctorId);

  return json({ valid: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const url    = new URL(req.url);
    // pathname after stripping /functions/v1/ prefix:  /auth-otp/set-pin  or  /auth-otp/verify-pin
    const action = url.pathname.split("/").at(-1);

    if (action === "set-pin")    return await setPin(req);
    if (action === "verify-pin") return await verifyPin(req);

    return json({ error: "Route not found" }, 404);

  } catch (e: any) {
    console.error("auth-otp unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal server error" }),
      { status: e.status ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }
});