"use client";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { ModuleShell } from "@/components/Shell";
import { bySlug, MODULE_NAV } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useModuleData, regionOf, constOf } from "@/lib/moduleData";
import { ExecKpi, Block, QuickAction } from "@/components/ui";
import StudyContextBar from "@/components/StudyContextBar";

export default function ModuleHome() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { projects, activeStudyId, setActiveStudy } = useWorkspace();
  if (!mod) return notFound();

  const studies = projects.filter((p) => p.project_type === mod.type);
  const ids = studies.map((s) => s.id);
  const d = useModuleData(ids);
  const base = `/modules/${slug}`;
  const today = new Date().toISOString().slice(0, 10);

  const totalResp = d.subs.length;
  const respToday = d.subs.filter((s) => (s.captured_at || "").slice(0, 10) === today).length;
  const live = d.qn.filter((q) => q.status === "published").length;
  const enumsToday = new Set(d.subs.filter((s) => (s.captured_at || "").slice(0, 10) === today).map((s) => s.enumerator_id).filter(Boolean)).size;
  const regions = new Set(d.subs.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean));
  const idset = new Set(d.subs.map((s) => s.client_id));
  const flags = d.flags.filter((f) => idset.has(f.submission_id));
  const flagged = new Set(flags.map((f) => f.submission_id)).size;
  const staged = d.subs.filter((s) => s.status === "staged").length;

  const respFor = (pid: string) => d.subs.filter((s) => s.project_id === pid).length;
  const liveFor = (pid: string) => d.qn.filter((q) => q.project_id === pid && q.status === "published").length;

  const ago = (iso: string) => {
    const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
    if (s < 60) return s + "s ago"; if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago"; return Math.floor(s / 86400) + "d ago";
  };
  const activity = [...d.subs]
    .sort((a, b) => +new Date(b.captured_at) - +new Date(a.captured_at))
    .slice(0, 6)
    .map((s) => ({
      who: d.users.find((u) => u.id === s.enumerator_id)?.full_name || "An enumerator",
      where: constOf(d.gidx, s.geo_unit_id) || regionOf(d.gidx, s.geo_unit_id) || "the field",
      proj: studies.find((p) => p.id === s.project_id)?.name || "a study",
      when: s.captured_at,
    }));

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Home`}>
      {/* module banner */}
      <div className="relative overflow-hidden rounded-[18px] p-8 text-white mb-6"
        style={{ background: `linear-gradient(115deg, ${mod.colour} 0%, #0B2647 135%)` }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-[12px] grid place-items-center font-display font-extrabold text-[16px] bg-white/15 border border-white/30">{mod.short}</span>
          <div>
            <h1 className="text-[28px] font-extrabold leading-none">{mod.label}</h1>
            <p className="mono text-[12px] text-white/75 mt-1">{studies.length} {studies.length === 1 ? "study" : "studies"} &middot; {totalResp.toLocaleString()} responses</p>
          </div>
        </div>
      </div>

      {/* active study context */}
      <StudyContextBar studies={studies} />

      {/* module KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <ExecKpi tone="b" k="Studies" v={studies.length} s={`${live} live questionnaires`} />
        <ExecKpi tone="g" k="Responses today" v={respToday} s={`of ${totalResp.toLocaleString()} total`} />
        <ExecKpi k="Active enumerators" v={enumsToday} s="contributed today" />
        <ExecKpi tone={flagged ? "r" : "g"} k="Flagged" v={flagged} s="awaiting review" />
      </div>

      {/* studies + fieldwork */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Block title="Studies in this module" right={<Link href={`${base}/studies`} className="text-[13px] text-blue font-semibold">Manage &rarr;</Link>}>
          {studies.length ? (
            <div className="flex flex-col">
              {studies.map((s) => {
                const on = s.id === activeStudyId;
                return (
                  <button key={s.id} onClick={() => setActiveStudy(s.id)}
                    className="flex items-center gap-3 py-3 border-b border-line-2 last:border-0 text-left">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${on ? "bg-lime-deep" : liveFor(s.id) ? "bg-blue" : "bg-muted-2"}`} />
                    <div className="flex-1">
                      <div className="text-[13.5px] font-semibold text-ink">
                        {s.name}{on && <span className="mono text-[9px] text-lime-deep ml-1.5">ACTIVE</span>}
                      </div>
                      <div className="mono text-[11px] text-muted mt-0.5">{respFor(s.id)} responses &middot; {liveFor(s.id)} live</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-2 text-[13px] mb-3">No studies in this module yet.</p>
              <Link href={`${base}/studies`} className="btn btn-accent h-9 px-4 text-[13px] inline-flex">+ New study</Link>
            </div>
          )}
        </Block>

        <Block title="Fieldwork status">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-well rounded-[11px] p-4"><div className="font-display text-[22px] font-extrabold text-blue">{enumsToday}</div><div className="text-[11px] text-muted mt-1">Enumerators collecting today</div></div>
            <div className="bg-well rounded-[11px] p-4"><div className="font-display text-[22px] font-extrabold text-blue">{respToday}</div><div className="text-[11px] text-muted mt-1">Interviews completed today</div></div>
            <div className="bg-well rounded-[11px] p-4"><div className="font-display text-[22px] font-extrabold text-blue">{staged}</div><div className="text-[11px] text-muted mt-1">Pending sync (staged)</div></div>
            <div className={`bg-well rounded-[11px] p-4`}><div className={`font-display text-[22px] font-extrabold ${flagged ? "text-signal" : "text-blue"}`}>{flagged}</div><div className="text-[11px] text-muted mt-1">Interviews to review</div></div>
            <div className="bg-well rounded-[11px] p-4"><div className="font-display text-[22px] font-extrabold text-blue">{regions.size}</div><div className="text-[11px] text-muted mt-1">Regions reached</div></div>
            <div className="bg-well rounded-[11px] p-4"><div className="font-display text-[22px] font-extrabold text-blue">{live}</div><div className="text-[11px] text-muted mt-1">Live questionnaires</div></div>
          </div>
        </Block>
      </div>

      {/* activity + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Block title="Recent activity">
          {activity.length ? (
            <div>
              {activity.map((e, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-line-2 last:border-0">
                  <span className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center font-display font-bold text-[12px] bg-lime-soft text-lime-deep">C</span>
                  <div>
                    <div className="text-[13.5px]"><b className="font-semibold">{e.who}</b> completed an interview in {e.where}</div>
                    <div className="mono text-[11.5px] text-muted mt-0.5">{e.proj} &middot; {ago(e.when)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-2 text-[13px] py-7">No activity yet in this module.</div>
          )}
        </Block>

        <Block title="Quick actions">
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction href={`${base}/studies`} label="New study" badge="+" colour="#8DC63F" />
            <QuickAction href={`${base}/builder`} label="Build questionnaire" badge="B" colour="#6B46C1" />
            <QuickAction href={`${base}/collect`} label="Collect responses" badge="C" colour="#3E9B54" />
            <QuickAction href={`${base}/dashboard`} label="View dashboard" badge="D" colour="#2E86C1" />
            <QuickAction href={`${base}/reports`} label="Generate report" badge="R" colour="#E0A32E" />
            <QuickAction href={`${base}/team`} label="Manage team" badge="T" colour="#0B4DA2" />
          </div>
        </Block>
      </div>
    </ModuleShell>
  );
}
