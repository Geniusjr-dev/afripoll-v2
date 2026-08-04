"use client";
import { useEffect, useState } from "react";
import { TeamMember, loadMemberWork, MemberWork, Assignment } from "@/lib/teamData";

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", org_admin: "Org Admin", project_manager: "Project Manager", supervisor: "Supervisor", enumerator: "Enumerator", data_analyst: "Data Analyst" };

export default function MemberPanel({ member, assignments, geoName, onClose }: {
  member: TeamMember; assignments: Assignment[]; geoName: (id: string) => string; onClose: () => void;
}) {
  const [work, setWork] = useState<MemberWork | null>(null);

  useEffect(() => {
    let live = true;
    setWork(null);
    loadMemberWork(member.id).then((w) => { if (live) setWork(w); });
    return () => { live = false; };
  }, [member.id]);

  const myAssignments = assignments.filter((a) => a.enumerator_id === member.id);
  const maxDay = work ? Math.max(1, ...work.perDay.map((d) => d.count)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <div className="w-full max-w-[540px] h-full bg-paper shadow-[-20px_0_60px_-20px_rgba(11,38,71,.4)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="sticky top-0 bg-ink text-white px-6 py-5 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-blue to-lime-deep grid place-items-center text-white text-[16px] font-bold">{initials(member.full_name)}</span>
              <div>
                <h2 className="text-[19px] font-bold leading-tight">{member.full_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="mono text-[10px] uppercase tracking-wide bg-white/15 rounded-full px-2 py-0.5">{ROLE_LABEL[member.role] || member.role}</span>
                  {!member.is_active && <span className="mono text-[10px] uppercase tracking-wide bg-signal/80 rounded-full px-2 py-0.5">Inactive</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-[22px] leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6">
          {!work ? (
            <div className="text-muted mono text-[13px] py-12 text-center">Loading work profile...</div>
          ) : (
            <>
              {/* productivity stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Stat k="Responses collected" v={work.total} />
                <Stat k="Active days" v={work.activeDays} />
                <Stat k="Average per day" v={work.avgPerDay} />
                <Stat k="Avg interview" v={work.avgDuration ? `${Math.floor(work.avgDuration / 60)}m ${work.avgDuration % 60}s` : "n/a"} />
              </div>

              {work.total === 0 ? (
                <div className="card p-8 text-center text-muted-2 text-[13px]">This member has not collected any responses yet.</div>
              ) : (
                <>
                  {/* activity timeline */}
                  <Block title="Activity over time">
                    <div className="flex items-end gap-1.5 h-28 mt-1">
                      {work.perDay.map((d) => (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-lime rounded-t-[3px] hover:bg-lime-deep transition" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 3 }} title={`${d.day}: ${d.count}`} />
                          <span className="mono text-[8px] text-muted-2">{d.day.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mono text-[10px] text-muted-2 mt-2">{work.firstDate} to {work.lastDate}</div>
                  </Block>

                  {/* areas worked */}
                  <Block title="Areas worked">
                    <div className="flex flex-col gap-2">
                      {work.areas.map((a) => {
                        const pct = (a.count / work.total) * 100;
                        return (
                          <div key={a.name} className="flex items-center gap-3">
                            <span className="text-[13px] text-ink w-32 truncate">{a.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-blue" style={{ width: `${pct}%` }} /></div>
                            <span className="mono text-[11px] text-muted-2 w-8 text-right">{a.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Block>
                </>
              )}

              {/* assigned areas */}
              <Block title="Assigned areas">
                {myAssignments.length === 0 ? (
                  <p className="text-muted-2 text-[12.5px] italic">No areas assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {myAssignments.map((a) => <span key={a.id} className="bg-well border border-line rounded-full px-3 py-1.5 text-[12px] text-ink">{geoName(a.geo_unit_id)}</span>)}
                  </div>
                )}
              </Block>

              {/* data quality */}
              {work.total > 0 && (
                <Block title="Data quality">
                  <p className="text-[13px] text-ink">
                    {work.flagged === 0
                      ? `None of this member's ${work.total} responses were flagged during screening.`
                      : `${work.flagged} of ${work.total} responses (${((100 * work.flagged) / work.total).toFixed(0)}%) were flagged for review.`}
                  </p>
                </Block>
              )}

              {/* recent submissions */}
              {work.recent.length > 0 && (
                <Block title="Recent submissions">
                  <div className="flex flex-col gap-1.5">
                    {work.recent.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-[12.5px] bg-surface border border-line rounded-[8px] px-3 py-2">
                        <span className="text-ink">{r.area}</span>
                        <span className="mono text-[11px] text-muted-2">{fmt(r.captured_at)}{r.duration ? ` \u00b7 ${Math.round(r.duration / 60)}m` : ""}</span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return <div className="card p-3.5"><div className="mono text-[9px] uppercase tracking-wide text-muted-2">{k}</div><div className="font-display text-[24px] font-extrabold text-ink mt-0.5">{v}</div></div>;
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-6"><h3 className="text-[13px] font-bold text-ink mb-2.5 pb-1.5 border-b border-line">{title}</h3>{children}</div>;
}
function initials(name: string): string { const p = (name || "").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?"; }
function fmt(d: string): string { try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return d?.slice(0, 16) || ""; } }
