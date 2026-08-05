import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side study deletion. Removes the study and all dependent rows in order,
// so foreign keys do not block it. Requires SUPABASE_SERVICE_ROLE_KEY.

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://knagokkqdtuduqfqqoih.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MANAGER_ROLES = ["super_admin", "org_admin", "project_manager", "supervisor"];

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: "Server is not configured. Set SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const { requesterId, studyId } = body || {};
  if (!requesterId || !studyId) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // authorise: requester is a manager, and the study is in their organisation
  const { data: requester } = await admin.from("users").select("id, role, organization_id").eq("id", requesterId).single();
  if (!requester || !MANAGER_ROLES.includes(String((requester as any).role))) {
    return NextResponse.json({ error: "You do not have permission to delete studies." }, { status: 403 });
  }
  const { data: study } = await admin.from("projects").select("id, organization_id, name").eq("id", studyId).single();
  if (!study) return NextResponse.json({ error: "Study not found." }, { status: 404 });
  if ((study as any).organization_id !== (requester as any).organization_id) {
    return NextResponse.json({ error: "Study is not in your organisation." }, { status: 403 });
  }

  // delete dependents in FK-safe order, then the study.
  // 1. submission flags for this study's submissions
  const { data: subs } = await admin.from("submissions").select("client_id").eq("project_id", studyId);
  const subIds = (subs || []).map((s: any) => s.client_id);
  if (subIds.length) { try { await admin.from("submission_flags").delete().in("submission_id", subIds); } catch {} }
  // 2. submissions
  await admin.from("submissions").delete().eq("project_id", studyId);
  // 3. questionnaire versions + questionnaires
  const { data: qns } = await admin.from("questionnaires").select("id").eq("project_id", studyId);
  const qnIds = (qns || []).map((q: any) => q.id);
  if (qnIds.length) { try { await admin.from("questionnaire_versions").delete().in("questionnaire_id", qnIds); } catch {} }
  await admin.from("questionnaires").delete().eq("project_id", studyId);
  // 4. area assignments scoped to this study
  try { await admin.from("area_assignments").delete().eq("project_id", studyId); } catch {}
  // 5. the study itself
  const { error: delErr } = await admin.from("projects").delete().eq("id", studyId);
  if (delErr) return NextResponse.json({ error: "Could not delete study: " + delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, deletedSubmissions: subIds.length });
}
