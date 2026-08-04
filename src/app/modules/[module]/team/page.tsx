"use client";
import { useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useTeamData, addAssignment, removeAssignment, TeamMember } from "@/lib/teamData";

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", owner: "Owner", supervisor: "Supervisor", enumerator: "Enumerator", analyst: "Analyst" };
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-blue-soft text-blue", owner: "bg-blue-soft text-blue", supervisor: "bg-[#EEF6E2] text-lime-deep",
  enumerator: "bg-well text-muted", analyst: "bg-[#F3EEFA] text-[#6a4c93]",
};

export default function TeamPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { user, profile } = useWorkspace();
  const team = useTeamData(profile?.organization_id);
  const [tab, setTab] = useState<"roster" | "assignments">("roster");

  const canManage = ["admin", "owner", "supervisor"].includes(profile?.role || "");

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
        <Roster members={team.members} />
      ) : (
        <Assignments team={team} enumerators={enumerators} canManage={canManage} orgId={profile?.organization_id || ""} userId={user?.id || ""} slug={slug} mod={mod} />
      )}
    </ModuleShell>
  );
}

function Roster({ members }: { members: TeamMember[] }) {
  const byRole = useMemo(() => {
    const order = ["owner", "admin", "supervisor", "analyst", "enumerator"];
    return [...members].sort((a, b) => (order.indexOf(a.role) - order.indexOf(b.role)) || b.responses - a.responses);
  }, [members]);
  const totalResponses = members.reduce((a, m) => a + m.responses, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi k="Team members" v={members.length} />
        <Kpi k="Enumerators" v={members.filter((m) => m.role === "enumerator").length} />
        <Kpi k="Supervisors" v={members.filter((m) => ["supervisor", "admin", "owner"].includes(m.role)).length} />
        <Kpi k="Responses collected" v={totalResponses} />
      </div>

      {members.length === 0 ? (
        <div className="card card-accent p-10 text-center"><p className="text-muted text-[14px]">No team members found for this organisation.</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="bg-well border-b border-line">
              {["Name", "Role", "Responses collected", "Share"].map((h, i) => <th key={h} className={`py-3 px-4 mono text-[10px] uppercase tracking-wide text-muted-2 font-semibold ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {byRole.map((m) => {
                const share = totalResponses ? (100 * m.responses) / totalResponses : 0;
                return (
                  <tr key={m.id} className="border-b border-line-2 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-lime-deep grid place-items-center text-white text-[12px] font-bold flex-shrink-0">{initials(m.full_name)}</span>
                        <span className="font-semibold text-ink">{m.full_name}</span>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
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
