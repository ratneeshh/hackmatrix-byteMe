/**
 * analytics/index.ts  — MediScribe Analytics Edge Function
 *
 * Routes (all require Authorization: Bearer <supabase_jwt>):
 *
 *   GET /analytics/summary  →  KPI summary stats
 *   GET /analytics/weekly   →  7-day session counts + growth
 *
 * Uses the views from 001_init.sql:
 *   doctor_analytics_summary   (total, avg_duration, sessions_today)
 *   doctor_top_diagnoses       (top ICD-10 codes)
 *   doctor_weekly_counts       (daily session counts, last 7 days)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/summary
// ─────────────────────────────────────────────────────────────────────────────

async function getSummary(doctorId: string) {
  // Pull from the materialized view
  const { data: summaryRow } = await adminClient
    .from("doctor_analytics_summary")
    .select("total_sessions, avg_duration_seconds, sessions_today")
    .eq("doctor_id", doctorId)
    .maybeSingle();

  // Top diagnoses from view
  const { data: diagnosisRows } = await adminClient
    .from("doctor_top_diagnoses")
    .select("icd10_code, description, occurrence_count")
    .eq("doctor_id", doctorId)
    .order("occurrence_count", { ascending: false })
    .limit(5);

  // Total unique patients
  const { count: totalPatients } = await adminClient
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId);

  // Completed sessions count
  const { count: completedSessions } = await adminClient
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .eq("status", "COMPLETE");

  const avgDuration = Math.round(summaryRow?.avg_duration_seconds ?? 0);
  // MediScribe avg vs 8-minute manual baseline
  const MANUAL_SECONDS       = 8 * 60;
  const avgTimeSaved         = Math.max(0, MANUAL_SECONDS - avgDuration);
  const timeSavedPercentage  = MANUAL_SECONDS > 0
    ? Math.round((avgTimeSaved / MANUAL_SECONDS) * 100)
    : 85; // default for demo

  return json({
    total_sessions:          summaryRow?.total_sessions ?? 0,
    completed_sessions:      completedSessions ?? 0,
    avg_duration_seconds:    avgDuration,
    sessions_today:          summaryRow?.sessions_today ?? 0,
    total_patients:          totalPatients ?? 0,
    avg_time_saved_seconds:  avgTimeSaved,
    time_saved_percentage:   timeSavedPercentage,
    top_diagnoses: (diagnosisRows ?? []).map(row => ({
      icd10: row.icd10_code,
      name:  row.description,
      count: row.occurrence_count,
    })),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/weekly
// ─────────────────────────────────────────────────────────────────────────────

async function getWeekly(doctorId: string) {
  // Pull from view (last 7 days, by date)
  const { data: viewRows } = await adminClient
    .from("doctor_weekly_counts")
    .select("session_date, session_count")
    .eq("doctor_id", doctorId)
    .order("session_date", { ascending: true });

  // Build a full 7-day series so gaps show as 0
  const today = new Date();
  const daily_counts = [];
  for (let i = 6; i >= 0; i--) {
    const d    = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const match   = (viewRows ?? []).find((r: any) => r.session_date === dateStr);
    daily_counts.push({ date: dateStr, count: match?.session_count ?? 0 });
  }

  // Average duration for this week's completed sessions
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: weekSessions } = await adminClient
    .from("sessions")
    .select("duration_seconds")
    .eq("doctor_id", doctorId)
    .eq("status", "COMPLETE")
    .gte("started_at", sevenDaysAgo.toISOString());

  const durations = (weekSessions ?? [])
    .map((s: any) => s.duration_seconds)
    .filter((d: any): d is number => typeof d === "number");

  const weeklyAvgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Growth: this week vs last week
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [{ count: thisWeek }, { count: lastWeek }] = await Promise.all([
    adminClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .gte("started_at", sevenDaysAgo.toISOString()),
    adminClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .gte("started_at", fourteenDaysAgo.toISOString())
      .lt("started_at", sevenDaysAgo.toISOString()),
  ]);

  const growthPercent = (lastWeek ?? 0) > 0
    ? Math.round(((thisWeek ?? 0) - (lastWeek ?? 0)) / (lastWeek ?? 1) * 100)
    : 0;

  return json({
    daily_counts,
    weekly_avg_duration: weeklyAvgDuration,
    total_this_week:     thisWeek ?? 0,
    growth_percent:      growthPercent,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const doctorId = await getDoctorId(req);

    const url      = new URL(req.url);
    const endpoint = url.pathname.split("/").filter(Boolean).pop(); // "summary" or "weekly"

    if (endpoint === "summary") return await getSummary(doctorId);
    if (endpoint === "weekly")  return await getWeekly(doctorId);

    return json({ error: "Route not found. Use /analytics/summary or /analytics/weekly" }, 404);

  } catch (e: any) {
    console.error("analytics unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal server error" }),
      { status: e.status ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
