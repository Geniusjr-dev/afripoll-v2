"use client";
import { useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useTeamData, addAssignment, removeAssignment, TeamMember, Assignment } from "@/lib/teamData";
import MemberPanel from "@/components/team/MemberPanel";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", org_admin: "Org Admin", project_manager: "Project Manager", supervisor: "Supervisor", enumerator: "Enumerator", data_analyst: "Data Analyst" };
const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-blue-soft text-blue", org_admin: "bg-blue-soft text-blue", project_manager: "bg-[#F3EEFA] text-[#6a4c93]",
  supervisor: "bg-[#EEF6E2] text-lime-deep", enumerator: "bg-well text-muted", data_analyst: "bg-[#FBF0E4] text-[#B26A00]",
};

export default function TeamPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { user, profile } = useWorkspace();
  const team = useTeamData(profile?.organization_id, mod?.type);
  const [tab, setTab] = useState<"roster" | "assignments">("roster");

  const canManage = ["super_admin", "org_admin", "project_manager", "supervisor"].includes(profile?.role || "");

  if (!mod) return notFound();

  const enumerators = team.members.filter((m) => m.role === "enumerator");

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Team`}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="kicker mb-1">Team</div>
          <h1 className="text-[24px] font-extrabold text-ink">People and area assignments</h1>
        </div>
        <div className="flex gap-1 bg-well rounded-full p-1 border border-line">
          {[["roster", "Team roster"], ["assignments", "Area assignments"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`text-[12.5px] font-semibold px-4 h-8 rounded-full ${tab === k ? "bg-blue text-white" : "text-muted"}`}>{label}</button>
          ))}
        </div>
      </div>

      {team.loading ? (
        <div className="text-muted mono text-[13px] py-10 text-center">Loading team...</div>
      ) : tab === "roster" ? (
        <Roster members={team.members} canManage={canManage} userId={user?.id || ""} refresh={team.refresh} assignments={team.assignments} geoName={(id: string) => team.geo.find((g: any) => g.id === id)?.name || id.slice(0, 8)} projectType={mod.type} orgId={profile?.organization_id} />
      ) : (
        <Assignments team={team} enumerators={enumerators} canManage={canManage} orgId={profile?.organization_id || ""} userId={user?.id || ""} slug={slug} mod={mod} />
      )}
    </ModuleShell>
  );
}

function Roster({ members, canManage, userId, refresh, assignments, geoName, projectType, orgId }: { members: TeamMember[]; canManage: boolean; userId: string; refresh: () => void; assignments: Assignment[]; geoName: (id: string) => string; projectType: string; orgId?: string | null }) {
  const [showAdd, setShowAdd] = useState(false);
  const [viewMember, setViewMember] = useState<TeamMember | null>(null);
  const byRole = useMemo(() => {
    const order = ["super_admin", "org_admin", "project_manager", "supervisor", "data_analyst", "enumerator"];
    return [...members].sort((a, b) => (order.indexOf(a.role) - order.indexOf(b.role)) || b.responses - a.responses);
  }, [members]);
  const totalResponses = members.reduce((a, m) => a + m.responses, 0);

  return (
    <>
      {canManage && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowAdd(true)} className="btn btn-accent h-10 px-4">+ Add team member</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi k="Team members" v={members.length} />
        <Kpi k="Enumerators" v={members.filter((m) => m.role === "enumerator").length} />
        <Kpi k="Supervisors" v={members.filter((m) => ["supervisor", "super_admin", "org_admin", "project_manager"].includes(m.role)).length} />
        <Kpi k="Responses collected" v={totalResponses} />
      </div>

      {members.length === 0 ? (
        <div className="card card-accent p-10 text-center"><p className="text-muted text-[14px]">No team members found for this organisation.</p></div>
      ) : (
        <div className="card p-0" style={{ overflow: "visible" }}>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-well border-b border-line">
              {["Name", "Role", "Responses collected", "Share"].map((h, i) => <th key={h} className={`py-3 px-4 mono text-[10px] uppercase tracking-wide text-muted-2 font-semibold ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>)}
              {canManage && <th className="py-3 px-4 mono text-[10px] uppercase tracking-wide text-muted-2 font-semibold text-right">Manage</th>}
            </tr></thead>
            <tbody>
              {byRole.map((m) => {
                const share = totalResponses ? (100 * m.responses) / totalResponses : 0;
                return (
                  <tr key={m.id} className={`border-b border-line-2 last:border-0 ${!m.is_active ? "opacity-55" : ""}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-lime-deep grid place-items-center text-white text-[12px] font-bold flex-shrink-0">{initials(m.full_name)}</span>
                        <button onClick={() => setViewMember(m)} className="font-semibold text-ink hover:text-blue hover:underline text-left">{m.full_name}</button>
                        {!m.is_active && <span className="mono text-[9px] uppercase tracking-wide bg-[#FBEAEA] text-signal rounded-full px-2 py-0.5">Inactive</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className={`mono text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1 ${ROLE_STYLE[m.role] || "bg-well text-muted"}`}>{ROLE_LABEL[m.role] || m.role}</span></td>
                    <td className="py-3 px-4 text-right mono font-semibold text-ink">{m.responses}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-lime" style={{ width: `${share}%` }} /></div>
                        <span className="mono text-[11px] text-muted-2 w-10 text-right">{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    {canManage && <td className="py-3 px-4 text-right"><RowActions member={m} userId={userId} refresh={refresh} /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showAdd && <AddMemberModal userId={userId} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); refresh(); }} />}
      {viewMember && <MemberPanel member={viewMember} assignments={assignments} geoName={geoName} projectType={projectType} orgId={orgId} onClose={() => setViewMember(null)} />}
    </>
  );
}

function RowActions({ member, userId, refresh }: { member: TeamMember; userId: string; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"" | "role" | "edit" | "delete">("");
  const [busy, setBusy] = useState(false);

  async function call(action: string, extra: any = {}) {
    setBusy(true);
    try {
      const res = await fetch("/api/team/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterId: userId, targetId: member.id, action, ...extra }) });
      const data = await res.json();
      if (!res.ok) return data;
      refresh();
      return { ok: true };
    } catch (e: any) { return { error: e?.message || "Network error" }; }
    finally { setBusy(false); }
  }

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="w-8 h-8 rounded-[7px] border border-line bg-surface text-muted hover:border-blue hover:text-blue">...</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 min-w-[190px] bg-surface border border-line rounded-[10px] shadow-[0_18px_44px_-14px_rgba(11,38,71,.3)] p-1 text-left" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <button onClick={() => { setOpen(false); setModal("edit"); }} className="block w-full text-left text-[13px] px-3 py-2 rounded-[7px] hover:bg-well">Edit name / email</button>
            <button onClick={() => { setOpen(false); setModal("role"); }} className="block w-full text-left text-[13px] px-3 py-2 rounded-[7px] hover:bg-well">Change role</button>
            {member.is_active
              ? <button onClick={async () => { setOpen(false); await call("active", { active: false }); }} className="block w-full text-left text-[13px] px-3 py-2 rounded-[7px] hover:bg-well text-gold">Deactivate</button>
              : <button onClick={async () => { setOpen(false); await call("active", { active: true }); }} className="block w-full text-left text-[13px] px-3 py-2 rounded-[7px] hover:bg-well text-lime-deep">Reactivate</button>}
            <button onClick={() => { setOpen(false); setModal("delete"); }} className="block w-full text-left text-[13px] px-3 py-2 rounded-[7px] hover:bg-[#FBEAEA] text-signal">Delete permanently</button>
          </div>
        </>
      )}
      {modal === "edit" && <EditMemberModal member={member} userId={userId} onClose={() => setModal("")} onSaved={() => { setModal(""); refresh(); }} />}
      {modal === "role" && <ChangeRoleModal member={member} onClose={() => setModal("")} onSave={async (role) => { const r = await call("role", { role }); if ((r as any).ok) setModal(""); return r; }} />}
      {modal === "delete" && <ConfirmDeleteModal member={member} onClose={() => setModal("")} onDelete={async (force) => { const r = await call("delete", { force }); if ((r as any).ok) setModal(""); return r; }} />}
    </div>
  );
}

function EditMemberModal({ member, userId, onClose, onSaved }: { member: TeamMember; userId: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(member.full_name === "(unnamed)" ? "" : member.full_name);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (!fullName && !email) { setMsg("Enter a name or a new email."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/team/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterId: userId, targetId: member.id, action: "edit", fullName, email: email || undefined }) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Could not update.");
      else onSaved();
    } catch (e: any) { setMsg("Network error: " + (e?.message || "")); }
    setBusy(false);
  }
  const fld = "w-full text-[13.5px] border border-line rounded-[8px] px-3 py-2.5 focus:outline-none focus:border-blue";
  const lbl = "block mono text-[9px] uppercase text-muted-2 mb-1.5 mt-3";
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[18px] font-bold text-ink mb-1">Edit member</h2>
      <p className="text-[12.5px] text-muted mb-2">Update <b>{member.full_name}</b>'s name or email.</p>
      <label className={lbl}>Full name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fld} placeholder="Full name" />
      <label className={lbl}>New email (optional)</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={fld} placeholder="Leave blank to keep current email" />
      {msg && <div className="text-signal text-[12.5px] mt-2">{msg}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
        <button onClick={save} className="btn btn-accent" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
      </div>
    </Modal>
  );
}

function ChangeRoleModal({ member, onClose, onSave }: { member: TeamMember; onClose: () => void; onSave: (role: string) => Promise<any> }) {
  const [role, setRole] = useState(member.role);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[18px] font-bold text-ink mb-1">Change role</h2>
      <p className="text-[12.5px] text-muted mb-3">Update the role for <b>{member.full_name}</b>.</p>
      <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-[13.5px] border border-line rounded-[8px] px-3 py-2.5">
        <option value="enumerator">Enumerator</option><option value="supervisor">Supervisor</option>
        <option value="data_analyst">Data Analyst</option><option value="project_manager">Project Manager</option>
        <option value="org_admin">Org Admin</option><option value="super_admin">Super Admin</option>
      </select>
      {msg && <div className="text-signal text-[12.5px] mt-2">{msg}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
        <button onClick={async () => { setBusy(true); setMsg(""); const r = await onSave(role); if (r?.error) setMsg(r.error); setBusy(false); }} className="btn btn-accent" disabled={busy}>{busy ? "Saving..." : "Save role"}</button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({ member, onClose, onDelete }: { member: TeamMember; onClose: () => void; onDelete: (force: boolean) => Promise<any> }) {
  const [msg, setMsg] = useState(""); const [needsForce, setNeedsForce] = useState(false); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState("");
  async function go(force: boolean) {
    setBusy(true); setMsg("");
    const r = await onDelete(force);
    if (r?.hasData) { setNeedsForce(true); setMsg(r.error); }
    else if (r?.error) setMsg(r.error);
    setBusy(false);
  }
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[18px] font-bold text-signal mb-1">Delete permanently</h2>
      <p className="text-[13px] text-muted mb-3">This removes <b>{member.full_name}</b>'s account entirely. Consider deactivating instead, which keeps their link to collected data.</p>
      {!needsForce ? (
        <>
          {msg && <div className="text-signal text-[12.5px] mb-2">{msg}</div>}
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={() => go(false)} className="btn h-9 px-4 text-[13px] bg-signal text-white hover:opacity-90" disabled={busy}>{busy ? "Deleting..." : "Delete"}</button>
          </div>
        </>
      ) : (
        <div className="bg-[#FBEAEA] border border-[#f3d5cf] rounded-[10px] p-3">
          <p className="text-[12.5px] text-signal mb-2">{msg}</p>
          <p className="text-[12px] text-muted mb-2">Type <b className="mono">DELETE</b> to permanently remove this member and unlink their collected data.</p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" className="w-full text-[13px] border border-line rounded-[8px] px-3 py-2 mb-3" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={() => go(true)} disabled={busy || confirm !== "DELETE"} className="btn h-9 px-4 text-[13px] bg-signal text-white hover:opacity-90 disabled:opacity-40">{busy ? "Deleting..." : "Confirm delete"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AddMemberModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("enumerator");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function genPassword() { const s = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; let p = ""; for (let i = 0; i < 12; i++) p += s[Math.floor(Math.random() * s.length)]; setPassword(p); }

  async function submit() {
    if (!fullName || !email || !password) { setMsg("Fill in name, email and password."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/team/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: userId, fullName, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Could not create member."); }
      else { setMsg("created"); }
    } catch (e: any) { setMsg("Network error: " + (e?.message || "")); }
    setBusy(false);
  }

  const fld = "w-full text-[13.5px] border border-line rounded-[8px] px-3 py-2.5 focus:outline-none focus:border-blue";
  const lbl = "block mono text-[9px] uppercase text-muted-2 mb-1.5 mt-3";

  if (msg === "created") {
    return (
      <Modal onClose={onCreated}>
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-lime-soft text-lime-deep grid place-items-center mx-auto mb-3 font-bold">OK</div>
          <h2 className="text-[18px] font-bold text-ink mb-2">Team member created</h2>
          <p className="text-[13px] text-muted mb-4">Share these credentials securely. They can change the password after signing in.</p>
          <div className="bg-well border border-line rounded-[10px] p-3 text-left mono text-[12px] mb-4">
            <div><span className="text-muted-2">email:</span> {email}</div>
            <div><span className="text-muted-2">password:</span> {password}</div>
          </div>
          <button onClick={onCreated} className="btn btn-accent">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-[19px] font-bold text-ink mb-1">Add team member</h2>
      <p className="text-[12.5px] text-muted mb-2">Creates an account immediately. You share the credentials with them.</p>
      <label className={lbl}>Full name</label>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fld} placeholder="e.g. Ama Mensah" />
      <label className={lbl}>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={fld} placeholder="name@example.com" />
      <label className={lbl}>Temporary password</label>
      <div className="flex gap-2">
        <input value={password} onChange={(e) => setPassword(e.target.value)} className={fld} placeholder="at least 8 characters" />
        <button onClick={genPassword} className="btn btn-ghost h-[42px] px-3 text-[12px] whitespace-nowrap">Generate</button>
      </div>
      <label className={lbl}>Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)} className={fld}>
        <option value="enumerator">Enumerator</option>
        <option value="supervisor">Supervisor</option>
        <option value="data_analyst">Data Analyst</option>
        <option value="project_manager">Project Manager</option>
        <option value="org_admin">Org Admin</option>
      </select>
      {msg && msg !== "created" && <div className="text-signal text-[12.5px] mt-3">{msg}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
        <button onClick={submit} className="btn btn-accent" disabled={busy}>{busy ? "Creating..." : "Create member"}</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="bg-surface rounded-[16px] p-6 max-w-[440px] w-full shadow-[0_30px_70px_-20px_rgba(11,38,71,.5)]" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Assignments({ team, enumerators, canManage, orgId, userId, slug, mod }: any) {
  const [selEnum, setSelEnum] = useState<string>(enumerators[0]?.id || "");
  const [selRegion, setSelRegion] = useState("");
  const [selConst, setSelConst] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const regions = team.geo.filter((g: any) => g.level === "region");
  const consts = team.geo.filter((g: any) => g.level === "constituency" && (!selRegion || g.parent_id === selRegion));
  const geoName = (id: string) => team.geo.find((g: any) => g.id === id)?.name || id.slice(0, 8);

  if (!team.assignmentsAvailable) {
    return (
      <div className="card card-accent p-8">
        <div className="kicker mb-2">Setup required</div>
        <h2 className="text-[19px] font-bold text-ink mb-2">The assignments table is not set up yet</h2>
        <p className="text-muted text-[14px] mb-4 max-w-xl">Area assignments need a table in your database. Run the provided <span className="mono text-ink">team-assignments-setup.sql</span> in your Supabase SQL editor, then reload this page. Team roster works without it.</p>
        <button onClick={team.refresh} className="btn btn-ghost">Reload</button>
      </div>
    );
  }

  async function assign() {
    if (!selEnum || (!selConst && !selRegion)) { setMsg("Pick an enumerator and an area."); return; }
    setBusy(true); setMsg("");
    const geoUnit = selConst || selRegion;
    const { error } = await addAssignment(orgId, selEnum, geoUnit, null, userId);
    if (error) setMsg("Could not assign: " + error.message);
    else { setMsg("Assigned."); team.refresh(); }
    setBusy(false);
  }
  async function unassign(id: string) {
    const { error } = await removeAssignment(id);
    if (!error) team.refresh();
  }

  const assignmentsByEnum = (eid: string) => team.assignments.filter((a: any) => a.enumerator_id === eid);

  return (
    <>
      <div className="card card-accent p-4 mb-5">
        <p className="text-[13px] text-ink"><b>How assignments work:</b> enumerators see and collect only in the areas assigned to them. Supervisors and administrators see all areas. Assign areas below; changes take effect immediately in the Collect app.</p>
      </div>

      {canManage && (
        <div className="card p-5 mb-5">
          <div className="kicker mb-3">Assign an area</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Field label="Enumerator"><select value={selEnum} onChange={(e) => setSelEnum(e.target.value)} className={sel}>{enumerators.length === 0 && <option value="">No enumerators</option>}{enumerators.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
            <Field label="Region"><select value={selRegion} onChange={(e) => { setSelRegion(e.target.value); setSelConst(""); }} className={sel}><option value="">Select region</option>{regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
            <Field label="Constituency (optional)"><select value={selConst} onChange={(e) => setSelConst(e.target.value)} className={sel} disabled={!selRegion}><option value="">Whole region</option>{consts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <button onClick={assign} disabled={busy || !selEnum} className="btn btn-accent h-10">{busy ? "Assigning..." : "Assign area"}</button>
          </div>
          {msg && <div className={`mt-2 text-[13px] ${msg === "Assigned." ? "text-lime-deep" : "text-signal"}`}>{msg}</div>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {enumerators.length === 0 && <div className="card p-8 text-center text-muted-2 text-[13px]">No enumerators to assign yet.</div>}
        {enumerators.map((m: any) => {
          const items = assignmentsByEnum(m.id);
          return (
            <div key={m.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-lime-deep grid place-items-center text-white text-[12px] font-bold">{initials(m.full_name)}</span>
                  <div><div className="font-semibold text-ink text-[14px]">{m.full_name}</div><div className="mono text-[10px] text-muted-2">{items.length} area{items.length === 1 ? "" : "s"} assigned</div></div>
                </div>
              </div>
              {items.length === 0 ? (
                <div className="text-muted-2 text-[12.5px] italic">No areas assigned. This enumerator currently sees no collection areas.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((a: any) => (
                    <span key={a.id} className="inline-flex items-center gap-2 bg-well border border-line rounded-full pl-3 pr-2 py-1.5 text-[12px]">
                      <span className="text-ink">{geoName(a.geo_unit_id)}</span>
                      {canManage && <button onClick={() => unassign(a.id)} className="w-4 h-4 rounded-full bg-line text-muted hover:bg-signal hover:text-white grid place-items-center text-[10px]">x</button>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const sel = "w-full text-[13px] border border-line rounded-[8px] px-2.5 py-2 bg-surface focus:outline-none focus:border-blue";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1">{label}</label>{children}</div>;
}
function Kpi({ k, v }: { k: string; v: string | number }) {
  return <div className="card p-4"><div className="mono text-[9px] uppercase tracking-wide text-muted-2">{k}</div><div className="font-display text-[26px] font-extrabold text-ink mt-1">{v}</div></div>;
}
function initials(name: string): string {
  const p = (name || "").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
