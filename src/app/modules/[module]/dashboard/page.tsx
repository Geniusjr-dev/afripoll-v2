"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useStudyData } from "@/lib/studyData";
import { regionOf, constOf } from "@/lib/orgData";
import { summarise, hbarSVG, donutSVG, columnSVG, Question, Summary } from "@/lib/analytics";
import { ExecKpi } from "@/components/ui";
import StudyContextBar from "@/components/StudyContextBar";

const CHOICE_TYPES = ["single_choice", "multiple_choice", "dropdown", "likert", "yes_no"];

export default function DashboardPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { projects, activeStudyId } = useWorkspace();
  if (!mod) return notFound();
  const studies = projects.filter((p) => p.project_type === mod.type);
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;
  const d = useStudyData(activeStudyId);

  const [chartPref, setChartPref] = useState<Record<string, string>>({});
  const [fRegion, setFRegion] = useState(""); const [fConst, setFConst] = useState("");
  const [fEnum, setFEnum] = useState(""); const [fFrom, setFFrom] = useState(""); const [fTo, setFTo] = useState("");
  const [fVars, setFVars] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return d.subs.filter((s) => {
      if (fRegion && regionOf(d.gidx, s.geo_unit_id) !== fRegion) return false;
      if (fConst && constOf(d.gidx, s.geo_unit_id) !== fConst) return false;
      if (fEnum && s.enumerator_id !== fEnum) return false;
      const dt = (s.captured_at || "").slice(0, 10);
      if (fFrom && dt && dt < fFrom) return false;
      if (fTo && dt && dt > fTo) return false;
      for (const code in fVars) {
        const want = fVars[code]; if (!want) continue;
        const v = s?.payload?.[code]; if (v == null) return false;
        const arr = Array.isArray(v) ? v.map(String) : [String(v)];
        if (!arr.includes(want)) return false;
      }
      return true;
    });
  }, [d.subs, d.gidx, fRegion, fConst, fEnum, fFrom, fTo, fVars]);

  const regions = useMemo(() => [...new Set(d.subs.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean))].sort() as string[], [d.subs, d.gidx]);
  const consts = useMemo(() => [...new Set(d.subs.map((s) => constOf(d.gidx, s.geo_unit_id)).filter(Boolean))].sort() as string[], [d.subs, d.gidx]);
  const enums = useMemo(() => [...new Set(d.subs.map((s) => s.enumerator_id).filter(Boolean))] as string[], [d.subs]);
  const userName = (id: string) => d.users.find((u) => u.id === id)?.full_name || "Unknown";

  const varFilters = d.questions.filter((q) => CHOICE_TYPES.includes(q.type));
  const activeFilterCount = [fRegion, fConst, fEnum, fFrom, fTo].filter(Boolean).length + Object.values(fVars).filter(Boolean).length;
  const clearAll = () => { setFRegion(""); setFConst(""); setFEnum(""); setFFrom(""); setFTo(""); setFVars({}); };

  if (!activeStudyId || !activeStudy) {
    return (
      <ModuleShell slug={slug} title={`${mod.label} - Dashboard`}>
        <StudyContextBar studies={studies} />
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">No study selected</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">Choose a study to see its dashboard</h2>
          <p className="text-muted text-[14px] max-w-md mx-auto mb-5">Pick a study from the bar above, or from the Studies page. The dashboard shows analytics for the active study only.</p>
          <Link href={`/modules/${slug}/studies`} className="btn inline-flex">Go to Studies</Link>
        </div>
      </ModuleShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const respToday = filtered.filter((s) => (s.captured_at || "").slice(0, 10) === today).length;
  const idset = new Set(filtered.map((s) => s.client_id));
  const flagged = new Set(d.flags.filter((f) => idset.has(f.submission_id)).map((f) => f.submission_id)).size;
  const dq = filtered.length ? Math.round((100 * (filtered.length - flagged)) / filtered.length) : 100;

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Dashboard`}>
      <StudyContextBar studies={studies} />

      <div className="mb-5">
        <div className="kicker mb-1">Live analytics {d.qnName ? `- ${d.qnName}` : ""}</div>
        <h1 className="text-[26px] font-extrabold text-ink">{activeStudy.name}</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <ExecKpi tone="b" k="Responses" v={filtered.length.toLocaleString()} s={activeFilterCount ? `filtered of ${d.subs.length}` : "total collected"} />
        <ExecKpi tone="g" k="Responses today" v={respToday} s="captured today" />
        <ExecKpi k="Regions" v={new Set(filtered.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean)).size} s="reached" />
        <ExecKpi tone={dq >= 90 ? "g" : "w"} k="Data quality" v={`${dq}%`} s="screening pass rate" />
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="kicker">Filters</span>
          <span className="mono text-[11px] text-blue flex-1">{activeFilterCount ? `${activeFilterCount} active - showing ${filtered.length} of ${d.subs.length}` : ""}</span>
          <button onClick={clearAll} className="text-[11px] mono border border-line rounded-[7px] px-2.5 h-7 text-muted hover:border-signal hover:text-signal">Clear all</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <FField label="Region"><select value={fRegion} onChange={(e) => setFRegion(e.target.value)} className={sel(fRegion)}><option value="">All regions</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}</select></FField>
          <FField label="Constituency"><select value={fConst} onChange={(e) => setFConst(e.target.value)} className={sel(fConst)}><option value="">All constituencies</option>{consts.map((c) => <option key={c} value={c}>{c}</option>)}</select></FField>
          <FField label="Enumerator"><select value={fEnum} onChange={(e) => setFEnum(e.target.value)} className={sel(fEnum)}><option value="">All enumerators</option>{enums.map((id) => <option key={id} value={id}>{userName(id)}</option>)}</select></FField>
          <FField label="From"><input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={sel(fFrom)} /></FField>
          <FField label="To"><input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={sel(fTo)} /></FField>
        </div>
        {varFilters.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-2.5">
            {varFilters.map((q) => {
              let labels: Record<string, string> = {};
              if (q.type === "yes_no") labels = { yes: "Yes", no: "No" };
              else (q.options || []).forEach((o) => (labels[o.code] = o.label));
              const keys = Object.keys(labels); if (!keys.length) return null;
              return (
                <FField key={q.code} label={q.label.length > 32 ? q.label.slice(0, 32) + "..." : q.label}>
                  <select value={fVars[q.code] || ""} onChange={(e) => setFVars((p) => ({ ...p, [q.code]: e.target.value }))} className={sel(fVars[q.code] || "")}>
                    <option value="">All</option>{keys.map((k) => <option key={k} value={k}>{labels[k]}</option>)}
                  </select>
                </FField>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-question analysis */}
      {d.loading ? (
        <div className="text-muted mono text-[13px] py-10 text-center">Loading responses...</div>
      ) : d.questions.length === 0 ? (
        <div className="card card-accent p-10 text-center">
          <h2 className="text-[19px] font-bold text-ink mb-2">No questionnaire found</h2>
          <p className="text-muted text-[14px] max-w-md mx-auto">This study has no published questionnaire yet, so there are no questions to analyse. Build and publish one in the Builder.</p>
          <Link href={`/modules/${slug}/builder`} className="btn mt-4 inline-flex">Open Builder</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {d.questions.map((q, i) => (
            <QuestionCard key={q.code} q={q} idx={i + 1} subs={filtered}
              pref={chartPref[q.code]} onPref={(p) => setChartPref((s) => ({ ...s, [q.code]: p }))} />
          ))}
        </div>
      )}
    </ModuleShell>
  );
}

function sel(v: string) {
  return `w-full text-[13px] border rounded-[8px] px-2.5 py-2 ${v ? "border-lime bg-lime-soft" : "border-line bg-surface"} focus:outline-none focus:border-blue`;
}
function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mono text-[9px] tracking-wide uppercase text-muted-2 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function QuestionCard({ q, idx, subs, pref, onPref }: { q: Question; idx: number; subs: any[]; pref?: string; onPref: (p: string) => void }) {
  const sum = summarise(q, subs);
  const typeLabel = QTYPE[q.type] || q.type;

  let options: string[] = [];
  if (sum.kind === "choice") options = ["bar", "column", "donut", "table"];
  else if (sum.kind === "num") options = ["column", "stats", "table"];
  const chosen = pref || options[0] || "table";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-[16px] font-bold text-ink"><span className="text-muted-2 mono text-[13px] mr-1">{idx}.</span> {q.label}</h3>
        <span className="mono text-[10px] tracking-wide uppercase text-muted-2 whitespace-nowrap">{typeLabel} &middot; n={sum.n}</span>
      </div>
      {options.length > 1 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {options.map((o) => (
            <button key={o} onClick={() => onPref(o)}
              className={`mono text-[10.5px] uppercase tracking-wide px-2.5 h-7 rounded-[7px] border ${chosen === o ? "bg-blue text-white border-blue" : "bg-well border-line text-muted hover:border-blue"}`}>
              {o}
            </button>
          ))}
        </div>
      )}
      <ChartArea q={q} sum={sum} chosen={chosen} />
    </div>
  );
}

function ChartArea({ q, sum, chosen }: { q: Question; sum: Summary; chosen: string }) {
  if (sum.n === 0) return <div className="text-muted-2 text-[13px] py-6 text-center">No responses to this question yet.</div>;

  if (sum.kind === "choice") {
    if (chosen === "donut") return <div dangerouslySetInnerHTML={{ __html: donutSVG(sum.rows) }} />;
    if (chosen === "column") return <div dangerouslySetInnerHTML={{ __html: columnSVG(sum.rows.map((r) => r.label), sum.rows.map((r) => r.count)) }} />;
    if (chosen === "table") return <ChoiceTable rows={sum.rows} />;
    return <div dangerouslySetInnerHTML={{ __html: hbarSVG(sum.rows) }} />;
  }
  if (sum.kind === "num") {
    if (chosen === "stats" || chosen === "table") return <StatStrip s={sum} />;
    const keys = Object.keys(sum.dist).sort((a, b) => Number(a) - Number(b));
    return (
      <div>
        <StatStrip s={sum} />
        <div dangerouslySetInnerHTML={{ __html: columnSVG(keys, keys.map((k) => sum.dist[k])) }} />
      </div>
    );
  }
  // text
  return (
    <div className="flex flex-col gap-2">
      {sum.samples.length ? sum.samples.map((t, i) => (
        <div key={i} className="bg-well rounded-[9px] px-3 py-2.5 text-[13px] text-ink">{t}</div>
      )) : <div className="text-muted-2 text-[13px]">No text responses.</div>}
      {sum.n > sum.samples.length && <div className="mono text-[11px] text-muted-2">Showing {sum.samples.length} of {sum.n} responses.</div>}
    </div>
  );
}

function ChoiceTable({ rows }: { rows: { label: string; count: number; pct: number }[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="border-b-2 border-blue"><th className="text-left mono text-[10px] uppercase text-muted-2 font-medium py-2">Option</th><th className="text-right mono text-[10px] uppercase text-muted-2 font-medium">Count</th><th className="text-right mono text-[10px] uppercase text-muted-2 font-medium">%</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.label} className="border-b border-line-2"><td className="py-2.5">{r.label}</td><td className="text-right mono">{r.count}</td><td className="text-right mono">{r.pct.toFixed(1)}%</td></tr>
      ))}</tbody>
    </table>
  );
}

function StatStrip({ s }: { s: any }) {
  const cell = (l: string, v: string | number) => (
    <div className="bg-well border border-line rounded-[9px] px-3 py-2 min-w-[74px]">
      <div className="mono text-[9px] uppercase tracking-wide text-muted-2">{l}</div>
      <div className="font-display text-[17px] font-bold text-ink mt-0.5">{v}</div>
    </div>
  );
  return (
    <div className="flex gap-2 flex-wrap mb-1">
      {cell("Mean", s.mean.toFixed(2))}{cell("Median", s.median.toFixed(2))}{cell("Mode", s.mode ?? "-")}
      {cell("Std dev", s.sd.toFixed(2))}{cell("Min", s.min)}{cell("Max", s.max)}{cell("n", s.n)}
    </div>
  );
}

const QTYPE: Record<string, string> = {
  single_choice: "Multiple choice", multiple_choice: "Checkboxes", dropdown: "Dropdown",
  likert: "Likert scale", yes_no: "Yes / No", rating: "Linear scale", number: "Number",
  short_text: "Short answer", long_text: "Paragraph", date: "Date", time: "Time", gps: "GPS",
};
