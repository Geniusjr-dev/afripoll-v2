"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useStudyData } from "@/lib/studyData";
import { regionOf, constOf } from "@/lib/orgData";
import { summarise, hbarSVG, donutSVG, columnSVG, pieSVG, lineSVG, histogramSVG } from "@/lib/analytics";
import { correlation } from "@/lib/statistics";
import { REPORT_TYPES, SECTION_LABELS, SectionKey } from "@/lib/reportConfig";
import CrossTabSection from "@/components/reports/CrossTabSection";
import StudyContextBar from "@/components/StudyContextBar";

export default function ReportsPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { profile, projects, activeStudyId } = useWorkspace();
  const studies = mod ? projects.filter((p) => p.project_type === mod.type) : [];
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;
  const d = useStudyData(activeStudyId);

  const [reportType, setReportType] = useState("executive");
  const [chartStyle, setChartStyle] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState<string[]>([""]);
  const [confidentiality, setConfidentiality] = useState("Internal");
  const [version, setVersion] = useState("1.0");
  const [copied, setCopied] = useState(false);

  const rt = REPORT_TYPES.find((r) => r.key === reportType)!;
  const has = (s: SectionKey) => rt.sections.includes(s);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const stats = useMemo(() => {
    const subs = d.subs;
    const regions = [...new Set(subs.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean))] as string[];
    const consts = [...new Set(subs.map((s) => constOf(d.gidx, s.geo_unit_id)).filter(Boolean))] as string[];
    const idset = new Set(subs.map((s) => s.client_id));
    const flagged = new Set(d.flags.filter((f) => idset.has(f.submission_id)).map((f) => f.submission_id)).size;
    const dq = subs.length ? Math.round((100 * (subs.length - flagged)) / subs.length) : 100;
    const dates = subs.map((s) => (s.captured_at || "").slice(0, 10)).filter(Boolean).sort();
    const enums = new Set(subs.map((s) => s.enumerator_id).filter(Boolean));
    const durations = subs.map((s) => s.duration_seconds).filter((x) => typeof x === "number" && x > 0) as number[];
    const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const gps = subs.filter((s) => s.gps_accuracy_m != null).length;
    return { n: subs.length, regions, consts, flagged, dq, first: dates[0], last: dates[dates.length - 1], enums: enums.size, avgDur, gpsRate: subs.length ? Math.round((100 * gps) / subs.length) : 0 };
  }, [d]);

  if (!mod) return notFound();
  if (!activeStudyId || !activeStudy) {
    return (
      <ModuleShell slug={slug} title={`${mod.label} - Reports`}>
        <StudyContextBar studies={studies} />
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">No study selected</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">Choose a study to generate its report</h2>
          <Link href={`/modules/${slug}/studies`} className="btn inline-flex mt-2">Go to Studies</Link>
        </div>
      </ModuleShell>
    );
  }

  const numQs = d.questions.filter((q) => ["rating", "number", "star_rating", "slider"].includes(q.type));

  function autoInsights(): string[] {
    const out: string[] = [];
    d.questions.forEach((q) => {
      const s = summarise(q, d.subs);
      if (s.kind === "choice" && s.n >= 3) {
        const top = [...s.rows].sort((a, b) => b.count - a.count)[0];
        if (top && top.pct >= 50) out.push(`On "${q.label}", a majority (${top.pct.toFixed(1)}%) selected "${top.label}".`);
        else if (top) out.push(`On "${q.label}", the leading response was "${top.label}" at ${top.pct.toFixed(1)}%.`);
      }
      if (s.kind === "num" && s.n >= 3) {
        out.push(`"${q.label}" averaged ${s.mean.toFixed(2)} (median ${s.median.toFixed(2)}) on a ${s.min}-${s.max} range.`);
      }
    });
    if (numQs.length >= 2) {
      const c = correlation(numQs[0].code, numQs[1].code, d.subs);
      if (c.n >= 4 && Math.abs(c.r) >= 0.3) out.push(`There is a ${c.r > 0 ? "positive" : "negative"} correlation (r = ${c.r.toFixed(2)}) between "${numQs[0].label}" and "${numQs[1].label}".`);
    }
    if (stats.regions.length >= 2) out.push(`Responses span ${stats.regions.length} regions, led by ${stats.regions[0]}.`);
    return out.length ? out : ["Not enough data yet to surface patterns. Insights improve as more responses arrive."];
  }

  function plainSummary(): string {
    const L: string[] = [];
    L.push(`${activeStudy!.name} - ${rt.name}`); L.push(`Prepared ${today} by ${profile?.full_name || "AfriPoll"}`); L.push("");
    L.push(`Responses: ${stats.n} | Regions: ${stats.regions.length} | Constituencies: ${stats.consts.length} | Data quality: ${stats.dq}%`); L.push("");
    L.push("KEY INSIGHTS"); autoInsights().forEach((i) => L.push("- " + i)); L.push("");
    d.questions.forEach((q, i) => {
      const s = summarise(q, d.subs); L.push(`${i + 1}. ${q.label}`);
      if (s.kind === "choice") s.rows.forEach((r) => L.push(`   ${r.label}: ${r.count} (${r.pct.toFixed(1)}%)`));
      else if (s.kind === "num") L.push(`   mean ${s.mean.toFixed(2)}, median ${s.median.toFixed(2)}, n=${s.n}`);
      L.push("");
    });
    const recs = recommendations.filter((r) => r.trim());
    if (recs.length) { L.push("RECOMMENDATIONS"); recs.forEach((r, i) => L.push(`${i + 1}. ${r}`)); }
    return L.join("\n");
  }
  async function copySummary() { try { await navigator.clipboard.writeText(plainSummary()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} }

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Reports`}>
      <div className="no-print">
        <StudyContextBar studies={studies} />
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div><div className="kicker mb-1">Report generator</div><h1 className="text-[24px] font-extrabold text-ink">{activeStudy.name}</h1></div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={copySummary}>{copied ? "Copied" : "Copy summary"}</button>
            <button className="btn btn-accent" onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        </div>
        {/* report type + meta controls */}
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Report type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full text-[13px] border border-line rounded-[8px] px-2.5 py-2">
                {REPORT_TYPES.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select>
            </div>
            <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Confidentiality</label>
              <select value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)} className="w-full text-[13px] border border-line rounded-[8px] px-2.5 py-2"><option>Public</option><option>Internal</option><option>Confidential</option><option>Strictly confidential</option></select></div>
            <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Version</label>
              <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full text-[13px] border border-line rounded-[8px] px-2.5 py-2" /></div>
            <div className="flex items-end"><p className="text-[11.5px] text-muted">{rt.blurb}</p></div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {rt.sections.map((s) => <span key={s} className="mono text-[9.5px] uppercase tracking-wide bg-blue-soft text-blue rounded-full px-2 py-0.5">{SECTION_LABELS[s]}</span>)}
          </div>
        </div>
      </div>

      {/* ===== REPORT DOCUMENT ===== */}
      <div className="report-doc bg-surface border border-line rounded-xl2 shadow-card max-w-[900px] mx-auto">
        {d.loading ? (
          <div className="text-muted mono text-[13px] py-16 text-center">Compiling report...</div>
        ) : d.questions.length === 0 ? (
          <div className="text-center py-16 px-8">
            <p className="text-muted text-[14px]">No published questionnaire for this study, so there is nothing to report yet.</p>
            <Link href={`/modules/${slug}/builder`} className="btn mt-4 inline-flex no-print">Open Builder</Link>
          </div>
        ) : (
          <div className="p-10">
            {/* COVER */}
            {has("cover") && (
              <section className="text-center py-10 border-b-2 border-ink mb-8 break-after">
                <div className="font-display font-extrabold text-blue text-[15px] tracking-wide mb-6">AfriPoll Analytics</div>
                <div className="kicker mb-3">{mod.label}</div>
                <h1 className="text-[34px] font-extrabold text-ink leading-tight mb-2">{activeStudy.name}</h1>
                {activeStudy.description && <p className="text-[14px] text-muted mb-6">{activeStudy.description}</p>}
                <div className="text-[20px] font-bold text-blue mb-8">{rt.name}</div>
                <div className="inline-grid grid-cols-2 gap-x-8 gap-y-2 text-left mono text-[12px] text-muted">
                  <span className="text-muted-2">Date</span><span className="text-ink">{today}</span>
                  <span className="text-muted-2">Prepared by</span><span className="text-ink">{profile?.full_name || "AfriPoll"}</span>
                  <span className="text-muted-2">Version</span><span className="text-ink">{version}</span>
                  <span className="text-muted-2">Confidentiality</span><span className="text-ink">{confidentiality}</span>
                  <span className="text-muted-2">Responses</span><span className="text-ink">{stats.n}</span>
                </div>
              </section>
            )}

            {/* EXEC SUMMARY */}
            {has("exec") && (
              <Section title="Executive summary">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Kpi k="Responses" v={stats.n} /><Kpi k="Regions" v={stats.regions.length} /><Kpi k="Constituencies" v={stats.consts.length} /><Kpi k="Data quality" v={`${stats.dq}%`} />
                </div>
                <p className="text-[13.5px] text-ink leading-relaxed">
                  This report summarises {stats.n} response{stats.n === 1 ? "" : "s"} for {activeStudy.name}
                  {stats.first ? ` collected between ${stats.first} and ${stats.last}` : ""}
                  {stats.regions.length ? `, covering ${stats.regions.slice(0, 4).join(", ")}${stats.regions.length > 4 ? " and others" : ""}` : ""}.
                  The screening pass rate was {stats.dq}%{stats.flagged ? `, with ${stats.flagged} flagged for review` : ", with no flags"}.
                </p>
                <div className="mt-3">
                  <div className="text-[13px] font-bold text-ink mb-1">Key findings</div>
                  <ul className="list-disc pl-5 text-[13px] text-ink leading-relaxed">{autoInsights().slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              </Section>
            )}

            {/* METHODOLOGY */}
            {has("methodology") && (
              <Section title="Methodology">
                <table className="w-full text-[13px]"><tbody>
                  {[["Study objectives", activeStudy.description || "Assess and report on " + activeStudy.name],
                    ["Module", mod.label], ["Research design", "Structured survey via AfriPoll digital collection"],
                    ["Sample size", `${stats.n} responses`], ["Coverage", `${stats.regions.length} regions, ${stats.consts.length} constituencies`],
                    ["Data collection dates", stats.first ? `${stats.first} to ${stats.last}` : "n/a"],
                    ["Enumerators", `${stats.enums}`], ["Data quality checks", `Automated screening; ${stats.dq}% pass rate`],
                    ["Average interview duration", stats.avgDur ? `${Math.floor(stats.avgDur / 60)}m ${stats.avgDur % 60}s` : "n/a"],
                  ].map(([k, v]) => <tr key={k} className="border-b border-line-2"><td className="py-2 pr-4 font-semibold text-ink w-[220px] align-top">{k}</td><td className="py-2 text-muted">{v}</td></tr>)}
                </tbody></table>
              </Section>
            )}

            {/* KPI DASHBOARD */}
            {has("kpi") && (
              <Section title="Dashboard summary">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi k="Total responses" v={stats.n} /><Kpi k="Active enumerators" v={stats.enums} />
                  <Kpi k="Regions covered" v={stats.regions.length} /><Kpi k="Constituencies" v={stats.consts.length} />
                  <Kpi k="GPS capture rate" v={`${stats.gpsRate}%`} /><Kpi k="Avg duration" v={stats.avgDur ? `${Math.floor(stats.avgDur / 60)}m` : "n/a"} />
                  <Kpi k="Flagged" v={stats.flagged} /><Kpi k="Data quality" v={`${stats.dq}%`} />
                </div>
              </Section>
            )}

            {/* CHARTS + TABLES */}
            {has("charts") && (
              <Section title="Findings">
                <div className="flex flex-col gap-7">
                  {d.questions.map((q, i) => {
                    const s = summarise(q, d.subs);
                    const style = chartStyle[q.code] || (s.kind === "choice" ? "bar" : "column");
                    return (
                      <div key={q.code} className="break-inside-avoid">
                        <h3 className="text-[15px] font-bold text-ink mb-1">{i + 1}. {q.label}</h3>
                        <div className="mono text-[10.5px] text-muted-2 mb-2">n = {s.n}</div>
                        {s.kind === "choice" && s.n > 0 && (
                          <>
                            <div className="no-print flex gap-1.5 mb-2">{["bar", "column", "donut", "pie"].map((o) => (
                              <button key={o} onClick={() => setChartStyle((c) => ({ ...c, [q.code]: o }))} className={`mono text-[10px] uppercase px-2 h-6 rounded border ${style === o ? "bg-blue text-white border-blue" : "bg-well border-line text-muted"}`}>{o}</button>
                            ))}</div>
                            <div dangerouslySetInnerHTML={{ __html: style === "donut" ? donutSVG(s.rows) : style === "pie" ? pieSVG(s.rows) : style === "column" ? columnSVG(s.rows.map((r) => r.label), s.rows.map((r) => r.count)) : hbarSVG(s.rows) }} />
                            <DataTable head={["Option", "Count", "%"]} rows={s.rows.map((r) => [r.label, String(r.count), r.pct.toFixed(1) + "%"])} />
                          </>
                        )}
                        {s.kind === "num" && s.n > 0 && (
                          <>
                            <div className="flex gap-2 flex-wrap mb-2">{[["Mean", s.mean.toFixed(2)], ["Median", s.median.toFixed(2)], ["Mode", s.mode ?? "-"], ["Std dev", s.sd.toFixed(2)], ["Min", s.min], ["Max", s.max]].map(([l, v]) => <span key={l as string} className="bg-well border border-line rounded-[8px] px-2.5 py-1.5 text-[12px]"><b className="mono text-ink">{v}</b> <span className="text-muted-2">{l}</span></span>)}</div>
                            <div dangerouslySetInnerHTML={{ __html: histogramSVG(d.subs.map((x) => Number(x?.payload?.[q.code])).filter((v) => !isNaN(v))) }} />
                          </>
                        )}
                        {s.kind === "text" && <div className="flex flex-col gap-1.5">{s.samples.map((t, k) => <div key={k} className="bg-well rounded-[8px] px-3 py-2 text-[12.5px]">{t}</div>)}{s.n === 0 && <span className="text-muted-2 text-[13px]">No responses.</span>}</div>}
                        {s.n === 0 && s.kind !== "text" && <div className="text-muted-2 text-[13px]">No responses yet.</div>}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* CROSS-TAB */}
            {has("crosstab") && (
              <Section title="Cross-tabulation"><CrossTabSection questions={d.questions} subs={d.subs} /></Section>
            )}

            {/* STATISTICS */}
            {has("statistics") && (
              <Section title="Statistical analysis">
                <div className="text-[13px] font-bold text-ink mb-2">Descriptive statistics</div>
                <DataTable head={["Question", "n", "Mean", "Median", "Std dev", "Min", "Max"]}
                  rows={numQs.map((q) => { const s = summarise(q, d.subs) as any; return [q.label.slice(0, 40), String(s.n), s.mean?.toFixed(2) ?? "-", s.median?.toFixed(2) ?? "-", s.sd?.toFixed(2) ?? "-", String(s.min ?? "-"), String(s.max ?? "-")]; })} />
                {numQs.length >= 2 && (
                  <div className="mt-4">
                    <div className="text-[13px] font-bold text-ink mb-2">Correlations (Pearson r)</div>
                    <DataTable head={["Pair", "r", "n"]} rows={pairsOf(numQs).map(([a, b]) => { const c = correlation(a.code, b.code, d.subs); return [`${a.label.slice(0, 24)} x ${b.label.slice(0, 24)}`, c.r.toFixed(3), String(c.n)]; })} />
                  </div>
                )}
              </Section>
            )}

            {/* GEOGRAPHIC */}
            {has("geographic") && (
              <Section title="Geographic analysis">
                <DataTable head={["Region", "Responses", "%"]} rows={regionCounts(d).map((r) => [r.name, String(r.count), r.pct.toFixed(1) + "%"])} />
                <p className="text-[12px] text-muted-2 mt-3 no-print">Interactive constituency maps are added when boundary data is connected.</p>
              </Section>
            )}

            {/* AI INSIGHTS (rule-based now; AI wired later) */}
            {has("insights") && (
              <Section title="Insights">
                <ul className="list-disc pl-5 text-[13.5px] text-ink leading-relaxed flex flex-col gap-1.5">{autoInsights().map((t, i) => <li key={i}>{t}</li>)}</ul>
                <p className="text-[11.5px] text-muted-2 mt-3 no-print">These are generated from the data. AI-written narrative insights are added when the AI service is connected.</p>
              </Section>
            )}

            {/* RECOMMENDATIONS */}
            {has("recommendations") && (
              <Section title="Recommendations">
                <div className="no-print flex flex-col gap-2 mb-3">
                  {recommendations.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={r} onChange={(e) => setRecommendations((rs) => rs.map((x, j) => j === i ? e.target.value : x))} placeholder={`Recommendation ${i + 1}`} className="flex-1 text-[13px] border border-line rounded-[8px] px-3 py-2" />
                      <button onClick={() => setRecommendations((rs) => rs.filter((_, j) => j !== i))} className="text-muted-2 hover:text-signal px-2">x</button>
                    </div>
                  ))}
                  <button onClick={() => setRecommendations((rs) => [...rs, ""])} className="text-[12px] text-blue font-semibold text-left">+ Add recommendation</button>
                </div>
                <ol className="list-decimal pl-5 text-[13.5px] text-ink leading-relaxed flex flex-col gap-1">{recommendations.filter((r) => r.trim()).map((r, i) => <li key={i}>{r}</li>)}</ol>
                {recommendations.filter((r) => r.trim()).length === 0 && <p className="text-muted-2 text-[13px] print-only">No recommendations recorded.</p>}
              </Section>
            )}

            {/* APPENDIX */}
            {has("appendix") && (
              <Section title="Appendix">
                <div className="text-[13px] font-bold text-ink mb-2">A. Questionnaire</div>
                <ol className="list-decimal pl-5 text-[12.5px] text-muted mb-4 flex flex-col gap-0.5">{d.questions.map((q) => <li key={q.code}>{q.label} <span className="mono text-[10px] text-muted-2">({q.type})</span></li>)}</ol>
                <div className="text-[13px] font-bold text-ink mb-2">B. Codebook</div>
                <DataTable head={["Code", "Label", "Type"]} rows={d.questions.map((q) => [q.code, q.label.slice(0, 40), q.type])} />
                <div className="text-[13px] font-bold text-ink mt-4 mb-2">C. Data quality</div>
                <p className="text-[12.5px] text-muted">{stats.n} responses, {stats.flagged} flagged, {stats.dq}% pass rate, {stats.gpsRate}% with GPS.</p>
              </Section>
            )}

            <div className="border-t border-line mt-8 pt-4 mono text-[10.5px] text-muted-2 flex justify-between">
              <span>AfriPoll Analytics &middot; Data. Insight. Impact. &middot; {confidentiality}</span><span>{rt.name} v{version} &middot; {today}</span>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          aside, .sticky { display: none !important; }
          body { background: #fff !important; }
          .report-doc { border: none !important; box-shadow: none !important; max-width: 100% !important; }
          main, .ml-64 { margin-left: 0 !important; }
          .break-after { break-after: page; }
          .break-inside-avoid { break-inside: avoid; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: block; } }
      `}</style>
    </ModuleShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-8 break-inside-avoid"><h2 className="text-[18px] font-bold text-ink mb-3 pb-1.5 border-b border-line">{title}</h2>{children}</section>;
}
function Kpi({ k, v }: { k: string; v: string | number }) {
  return <div className="bg-well border border-line rounded-[10px] p-3"><div className="mono text-[9px] uppercase tracking-wide text-muted-2">{k}</div><div className="font-display text-[22px] font-extrabold text-ink mt-0.5">{v}</div></div>;
}
function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[12.5px] border-collapse">
        <thead><tr className="border-b-2 border-blue">{head.map((h, i) => <th key={i} className={`py-2 mono text-[10px] uppercase text-muted-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line-2">{r.map((c, j) => <td key={j} className={`py-2 ${j === 0 ? "text-left text-ink" : "text-right mono"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function pairsOf<T>(arr: T[]): [T, T][] { const out: [T, T][] = []; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]); return out; }
function regionCounts(d: any): { name: string; count: number; pct: number }[] {
  const m: Record<string, number> = {};
  d.subs.forEach((s: any) => { const r = regionOf(d.gidx, s.geo_unit_id) || "Unknown"; m[r] = (m[r] || 0) + 1; });
  const total = d.subs.length || 1;
  return Object.entries(m).map(([name, count]) => ({ name, count: count as number, pct: (100 * (count as number)) / total })).sort((a, b) => b.count - a.count);
}
