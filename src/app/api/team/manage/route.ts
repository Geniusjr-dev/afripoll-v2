import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side member management: change role, set active status, hard delete.
// Requires SUPABASE_SERVICE_ROLE_KEY. Never exposed to the browser.

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://knagokkqdtuduqfqqoih.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_ROLES = ["super_admin", "org_admin", "project_manager", "supervisor", "enumerator", "data_analyst"];
const MANAGER_ROLES = ["super_admin", "org_admin", "project_manager", "supervisor"];

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: "Server is not configured. Set SUPABASE_SERVICE_ROLE_KEY in the environment." }, { status: 500 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const { requesterId, action, targetId, role, active } = body || {};
  if (!requesterId || !action || !targetId) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // authorise requester
  const { data: requester, error: reqErr } = await admin.from("users").select("id, role, organization_id").eq("id", requesterId).single();
  if (reqErr || !requester) return NextResponse.json({ error: "Requester not found." }, { status: 403 });
  if (!MANAGER_ROLES.includes(String((requester as any).role))) return NextResponse.json({ error: "You do not have permission to manage team members." }, { status: 403 });
  const orgId = (requester as any).organization_id;

  // target must be in the same organisation
  const { data: target, error: tErr } = await admin.from("users").select("id, role, organization_id").eq("id", targetId).single();
  if (tErr || !target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if ((target as any).organization_id !== orgId) return NextResponse.json({ error: "Member is not in your organisation." }, { status: 403 });
  if (targetId === requesterId && (action === "delete" || (action === "active" && active === false)))
    return NextResponse.json({ error: "You cannot remove or deactivate your own account." }, { status: 400 });

  if (action === "edit") {
    const { fullName, email } = body;
    if (!fullName && !email) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    // update the users row name
    if (fullName) {
      const { error } = await admin.from("users").update({ full_name: fullName } as any).eq("id", targetId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // update auth email + metadata
    if (email) {
      const { error: aErr } = await admin.auth.admin.updateUserById(targetId, { email, email_confirm: true, user_metadata: { full_name: fullName || undefined } } as any);
      if (aErr) return NextResponse.json({ error: "Could not update email: " + aErr.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "role") {
    if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    const { error } = await admin.from("users").update({ role } as any).eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "active") {
    const { error } = await admin.from("users").update({ is_active: !!active } as any).eq("id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // also block/unblock sign-in via a long ban when deactivated
    try { await admin.auth.admin.updateUserById(targetId, active ? { ban_duration: "none" } as any : { ban_duration: "876000h" } as any); } catch {}
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    // check for collected responses; warn once, then on force, unlink the data (keep responses).
    const { count } = await admin.from("submissions").select("client_id", { count: "exact", head: true }).eq("enumerator_id", targetId);
    if ((count || 0) > 0 && !body.force) {
      return NextResponse.json({ error: `This member has collected ${count} response(s). On deletion their responses will be kept but no longer linked to a named collector.`, hasData: true, count }, { status: 409 });
    }
    // unlink collected responses so the FK does not block deletion (data is preserved).
    if ((count || 0) > 0) {
      const { error: unlinkErr } = await admin.from("submissions").update({ enumerator_id: null } as any).eq("enumerator_id", targetId);
      if (unlinkErr) return NextResponse.json({ error: "Could not unlink responses: " + unlinkErr.message }, { status: 400 });
    }
    await admin.from("area_assignments").delete().eq("enumerator_id", targetId);
    const { error: rowErr } = await admin.from("users").delete().eq("id", targetId);
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 400 });
    try { await admin.auth.admin.deleteUser(targetId); } catch {}
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
