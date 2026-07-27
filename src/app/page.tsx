"use client";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace";
import { useOrgData, regionOf, constOf } from "@/lib/orgData";
import { OrgShell } from "@/components/Shell";
import { ExecKpi, Block, QuickAction } from "@/components/ui";
import { MODULES } from "@/lib/modules";

export default function OrganisationHome() {
  const { profile, projects } = useWorkspace();
  const d = useOrgData();
  const name = profile?.full_name?.split(" ")[0] || "there";
  const today = new Date().toISOString().slice(0, 10);

  const totalResp = d.subs.length;
  const respToday = d.subs.filter((s) => (s.captured_at || "").slice(0, 10) === today).length;
  const liveStudies = new Set(d.qn.filter((q) => q.status === "published").map((q) => q.project_id)).size;
  const enumsToday = new Set(d.subs.filter((s) => (s.captured_at || "").slice(0, 10) === today).map((s) => s.enumerator_id).filter(Boolean)).size;
  const regions = new Set(d.subs.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean));
  const consts = new Set(d.subs.map((s) => constOf(d.gidx, s.geo_unit_id)).filter(Boolean));
  const ids = new Set(d.subs.map((s) => s.client_id));
  const flags = d.flags.filter((f) => ids.has(f.submission_id));
  const flagged = new Set(flags.map((f) => f.submission_id)).size;
  const dq = totalResp ? Math.round((100 * (totalResp - flagged)) / totalResp) : 100;
  const supervisors = d.users.filter((u) => u.role === "supervisor" && u.is_active !== false).length;

  const byModule = MODULES.map((m) => ({ ...m, n: projects.filter((p) => p.project_type === m.type).length }));
  const totalStudies = projects.length;
  const maxN = Math.max(1, ...byModule.map((m) => m.n));

  const plural = (n: number, noun: string, suffix?: string) => {
    const p = n === 1 ? noun : /y$/.test(noun) ? noun.replace(/y$/, "ies") : noun + "s";
    return `${n.toLocaleString()} ${p}${suffix ? " " + suffix : ""}`;
  };

  const activity = [...d.subs]
    .sort((a, b) => +new Date(b.captured_at) - +new Date(a.captured_at))
    .slice(0, 8)
    .map((s) => {
      const who = d.users.find((u) => u.id === s.enumerator_id)?.full_name || "An enumerator";
      const where = constOf(d.gidx, s.geo_unit_id) || regionOf(d.gidx, s.geo_unit_id) || "the field";
      const proj = projects.find((p) => p.id === s.project_id)?.name || "a study";
      return { who, where, proj, when: s.captured_at };
    });

  const alerts: { t: string; ok: boolean }[] = [];
  if (totalResp === 0) alerts.push({ t: "No responses yet. Publish a questionnaire inside a module to begin collection.", ok: false });
  if (flagged > 0) alerts.push({ t: `${flagged} interview${flagged > 1 ? "s" : ""} flagged by screening and awaiting review.`, ok: false });
  if (liveStudies === 0 && totalStudies > 0) alerts.push({ t: "No live questionnaires. No study is currently collecting.", ok: false });
  if (respToday === 0 && totalResp > 0) alerts.push({ t: "No responses today yet. Fieldwork has been quiet so far today.", ok: false });
  if (alerts.length === 0) alerts.push({ t: "All clear. No outstanding issues across the organisation.", ok: true });

  const ago = (iso: string) => {
    const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
    if (s < 60) return s + "s ago"; if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago"; return Math.floor(s / 86400) + "d ago";
  };

  return (
    <OrgShell title="Organisation Home">
      {/* banner */}
      <div className="relative overflow-hidden rounded-[18px] p-9 text-white mb-6"
        style={{ background: "linear-gradient(115deg,#0B4DA2 0%,#0a3f86 55%,#083B7D 100%)" }}>
        <div className="absolute top-7 right-8 mono text-[10.5px] tracking-wider uppercase text-[#DDF0BE] border border-lime/50 rounded-full px-3 py-1.5 bg-lime/[.16]">
          {(profile?.role || "").replace(/_/g, " ")}
        </div>
        <h1 className="text-[34px] font-extrabold mb-2">Welcome back, {name}</h1>
        <p className="mono text-[14px] text-[#CFE0F4]">
          {plural(totalStudies, "Active Study")} &middot; {plural(totalResp, "Response", "Collected")} &middot; {plural(regions.size, "Region", "Covered")}
        </p>
      </div>

      {/* executive KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <ExecKpi tone="b" k="Active studies" v={totalStudies} s={`${liveStudies} live`} />
        <ExecKpi tone="g" k="Responses today" v={respToday.toLocaleString()} s={`of ${totalResp.toLocaleString()} total`} />
        <ExecKpi k="Total responses" v={totalResp.toLocaleString()} s="accepted + staged" />
        <ExecKpi tone="b" k="Active enumerators" v={enumsToday} s="contributed today" />
        <ExecKpi k="Regions covered" v={regions.size} s="of 16" />
        <ExecKpi k="Constituencies" v={consts.size} s="of 276" />
        <ExecKpi tone={dq >= 90 ? "g" : "w"} k="Data quality" v={`${dq}%`} s="screening pass rate" />
        <ExecKpi tone={flagged ? "r" : "g"} k="Flagged" v={flagged} s={`${flags.length} flags raised`} />
      </div>

      {/* modules overview + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Block title="Research modules" right={<span className="mono text-[11px] text-muted-2">{totalStudies || 0} {totalStudies === 1 ? "study" : "studies"}</span>}>
          <div className="flex flex-col gap-1">
            {byModule.map((m) => (
              <Link key={m.slug} href={`/modules/${m.slug}`}
                className={`flex items-center gap-3 py-2 group ${m.n ? "" : "opacity-60"}`}>
                <span className="w-[11px] h-[11px] rounded-[3px] flex-shrink-0" style={{ background: m.n ? m.colour : "#CBD5E1" }} />
                <span className="flex-1 text-[13.5px] group-hover:text-blue transition">{m.label}</span>
                <span className="h-[5px] rounded-[3px] bg-well flex-1 max-w-[90px] overflow-hidden">
                  <span className="block h-full rounded-[3px]" style={{ width: `${m.n ? (100 * m.n) / maxN : 0}%`, background: m.colour }} />
                </span>
                <span className="font-display font-bold text-[14px] text-ink w-6 text-right">{m.n}</span>
              </Link>
            ))}
          </div>
        </Block>

        <Block title="Needs attention">
          <div className="flex flex-col gap-2.5">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 px-3.5 py-3 rounded-[11px] border ${a.ok ? "bg-lime-soft border-[#d3e8b6]" : "bg-[#fdf3f1] border-[#f3d5cf]"}`}>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.ok ? "bg-lime-deep" : "bg-signal"}`} />
                <span className="text-[13px]">{a.t}</span>
              </div>
            ))}
          </div>
        </Block>
      </div>

      {/* activity + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Block title="Live activity">
          {activity.length ? (
            <div>
              {activity.map((e, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-line-2 last:border-0">
                  <span className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center font-display font-bold text-[12px] bg-lime-soft text-lime-deep">C</span>
                  <div>
                    <div className="text-[13.5px] font-medium"><b className="font-semibold">{e.who}</b> completed an interview in {e.where}</div>
                    <div className="mono text-[11.5px] text-muted mt-0.5">{e.proj} &middot; {ago(e.when)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-2 text-[13px] py-7">No activity yet. Events appear here as fieldwork begins.</div>
          )}
        </Block>

        <Block title="Quick actions">
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction href="/organisation/dashboard" label="Executive dashboard" badge="D" colour="#0B4DA2" />
            <QuickAction href="/organisation/analytics" label="Cross-module analytics" badge="X" colour="#2E86C1" />
            <QuickAction href="/organisation/reports" label="Organisation reports" badge="R" colour="#E0A32E" />
            <QuickAction href="/organisation/team" label="Users & teams" badge="T" colour="#6B46C1" />
            <QuickAction href="/modules" label="Browse modules" badge="M" colour="#0E7C7B" />
            <QuickAction href="/organisation/settings" label="Settings" badge="S" colour="#5A6B7B" />
          </div>
        </Block>
      </div>
    </OrgShell>
  );
}
