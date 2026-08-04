import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Secure server-side team-member creation.
// Requires SUPABASE_SERVICE_ROLE_KEY set in the environment (Vercel env vars).
// The service-role key must NEVER be exposed to the browser.

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://knagokkqdtuduqfqqoih.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_ROLES = ["super_admin", "org_admin", "project_manager", "supervisor", "enumerator", "data_analyst"];
const MANAGER_ROLES = ["super_admin", "org_admin", "project_manager", "supervisor"];

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: "Server is not configured for user creation. Set SUPABASE_SERVICE_ROLE_KEY in the environment." }, { status: 500 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const { requesterId, fullName, email, password, role } = body || {};

  if (!requesterId || !fullName || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Authorise: the requester must exist and hold a manager role. Get their organisation.
  const { data: requester, error: reqErr } = await admin.from("users").select("id, role, organization_id").eq("id", requesterId).single();
  if (reqErr || !requester) {
    return NextResponse.json({ error: "Requester not found." }, { status: 403 });
  }
  if (!MANAGER_ROLES.includes(String((requester as any).role))) {
    return NextResponse.json({ error: "You do not have permission to add team members." }, { status: 403 });
  }
  const orgId = (requester as any).organization_id;

  // 2. Create the auth user (email confirmed so they can sign in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    return NextResponse.json({ error: "Could not create account: " + (createErr?.message || "unknown error") }, { status: 400 });
  }
  const newId = created.user.id;

  // 3. Create / upsert the matching users row with role + organisation.
  const { error: rowErr } = await admin.from("users").upsert({
    id: newId, full_name: fullName, role, organization_id: orgId,
  } as any, { onConflict: "id" });
  if (rowErr) {
    // roll back the auth user so we don't leave an orphan
    try { await admin.auth.admin.deleteUser(newId); } catch {}
    return NextResponse.json({ error: "Account created but profile failed: " + rowErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: newId });
}
