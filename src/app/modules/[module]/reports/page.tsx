"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useStudyData } from "@/lib/studyData";
import { regionOf, constOf } from "@/lib/orgData";
import { summarise, hbarSVG, donutSVG, columnSVG } from "@/lib/analytics";
import StudyContextBar from "@/components/StudyContextBar";

export default function ReportsPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { profile, projects, activeStudyId } = useWorkspace();
  const studies = mod ? projects.filter((p) => p.project_type === mod.type) : [];
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;
  const d = useStudyData(activeStudyId);
  const [copied, setCopied] = useState(false);
  const [chartStyle, setChartStyle] = useState<Record<string, string>>({});

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const stats = useMemo(() => {
    const subs = d.subs;
    const regions = [...new Set(subs.map((s) => regionOf(d.gidx, s.geo_unit_id)).filter(Boolean))] as string[];
    const consts = [...new Set(subs.map((s) => constOf(d.gidx, s.geo_unit_id)).filter(Boolean))] as string[];
    const idset = new Set(subs.map((s) => s.client_id));
    const flagged = new Set(d.flags.filter((f) => idset.has(f.submission_id)).map((f) => f.submission_id)).size;
    const dq = subs.length ? Math.round((100 * (subs.length - flagged)) / subs.length) : 100;
    const dates = subs.map((s) => (s.captured_at || "").slice(0, 10)).filter(Boolean).sort();
    return { n: subs.length, regions, consts, flagged, dq, first: dates[0], last: dates[dates.length - 1] };
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

  const choiceQs = d.questions.filter((q) => ["single_choice", "multiple_choice", "dropdown", "yes_no", "true_false", "likert", "satisfaction", "agreement", "party_selector", "region_selector", "constituency_selector"].includes(q.type));
  const numQs = d.questions.filter((q) => ["rating", "number", "star_rating", "slider"].includes(q.type));

  function plainSummary(): string {
    const lines: string[] = [];
    lines.push(`${activeStudy!.name} - Findings Report`);
    lines.push(`Prepared ${today}`);
    lines.push("");
    lines.push(`Total responses: ${stats.n}`);
    lines.push(`Coverage: ${stats.regions.length} region(s), ${stats.consts.length} constituency/ies`);
    if (stats.first) lines.push(`Fieldwork: ${stats.first} to ${stats.last}`);
    lines.push(`Data quality: ${stats.dq}% screening pass rate`);
    lines.push("");
    d.questions.forEach((q, i) => {
      const s = summarise(q, d.subs);
      lines.push(`${i + 1}. ${q.label}`);
      if (s.kind === "choice") {
        s.rows.forEach((r) => lines.push(`   - ${r.label}: ${r.count} (${r.pct.toFixed(1)}%)`));
      } else if (s.kind === "num") {
        lines.push(`   mean ${s.mean.toFixed(2)}, median ${s.median.toFixed(2)}, n=${s.n}`);
      } else {
        lines.push(`   ${s.n} text response(s)`);
      }
      lines.push("");
    });
    return lines.join("\n");
  }

  async function copySummary() {
    try { await navigator.clipboard.writeText(plainSummary()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {}
  }

  // narrative helper for a choice question
  function narrative(q: any): string {
    const s = summarise(q, d.subs);
    if (s.kind !== "choice" || s.n === 0) return "";
    const top = [...s.rows].sort((a, b) => b.count - a.count)[0];
    return `${top.label} was the most common response at ${top.pct.toFixed(1)}% (${top.count} of ${s.n}).`;
  }
  function numNarrative(q: any): string {
    const s = summarise(q, d.subs);
    if (s.kind !== "num" || s.n === 0) return "";
    return `The mean was ${s.mean.toFixed(2)} (median ${s.median.toFixed(2)}), ranging ${s.min} to ${s.max} across ${s.n} responses.`;
  }

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Reports`}>
      <div className="no-print">
        <StudyContextBar studies={studies} />
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div>
            <div className="kicker mb-1">Report generator</div>
            <h1 className="text-[24px] font-extrabold text-ink">{activeStudy.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost" onClick={copySummary}>{copied ? "Copied" : "Copy summary"}</button>
            <button className="btn btn-accent" onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        </div>
      </div>

      {/* the report document */}
      <div className="report-doc bg-surface border border-line rounded-xl2 shadow-card max-w-[860px] mx-auto">
        <div className="p-9">
          {/* header */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-5 mb-6">
            <div>
              <div className="kicker mb-1">AfriPoll Analytics &middot; Findings Report</div>
              <h1 className="text-[26px] font-extrabold text-ink leading-tight">{activeStudy.name}</h1>
              {activeStudy.description && <p className="text-[13px] text-muted mt-1">{activeStudy.description}</p>}
            </div>
            <div className="text-right mono text-[11px] text-muted-2">
              <div>{mod.label}</div><div>{today}</div>
              {profile?.full_name && <div>By {profile.full_name}</div>}
            </div>
          </div>

          {d.loading ? (
            <div className="text-muted mono text-[13px] py-10 text-center">Compiling report...</div>
          ) : d.questions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted text-[14px]">No published questionnaire for this study, so there is nothing to report yet.</p>
              <Link href={`/modules/${slug}/builder`} className="btn mt-4 inline-flex no-print">Open Builder</Link>
            </div>
          ) : (
            <>
              {/* executive summary */}
              <section className="mb-7">
                <h2 className="text-[17px] font-bold text-ink mb-3">Executive summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Kpi k="Responses" v={stats.n} />
                  <Kpi k="Regions" v={stats.regions.length} />
                  <Kpi k="Constituencies" v={stats.consts.length} />
                  <Kpi k="Data quality" v={`${stats.dq}%`} />
                </div>
                <p className="text-[13.5px] text-ink leading-relaxed">
                  This report summarises {stats.n} response{stats.n === 1 ? "" : "s"} collected for {activeStudy.name}
                  {stats.first ? ` between ${stats.first} and ${stats.last}` : ""}
                  {stats.regions.length ? `, covering ${stats.regions.join(", ")}` : ""}. The screening pass rate was {stats.dq}%
                  {stats.flagged ? `, with ${stats.flagged} response${stats.flagged === 1 ? "" : "s"} flagged for review.` : ", with no responses flagged."}
                </p>
              </section>

              {/* per-question findings */}
              <section>
                <h2 className="text-[17px] font-bold text-ink mb-4">Findings</h2>
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
                            <div className="no-print flex gap-1.5 mb-2">
                              {["bar", "donut", "column"].map((o) => (
                                <button key={o} onClick={() => setChartStyle((c) => ({ ...c, [q.code]: o }))}
                                  className={`mono text-[10px] uppercase px-2 h-6 rounded border ${style === o ? "bg-blue text-white border-blue" : "bg-well border-line text-muted"}`}>{o}</button>
                              ))}
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: style === "donut" ? donutSVG(s.rows) : style === "column" ? columnSVG(s.rows.map((r) => r.label), s.rows.map((r) => r.count)) : hbarSVG(s.rows) }} />
                            <p className="text-[13px] text-muted mt-2">{narrative(q)}</p>
                          </>
                        )}
                        {s.kind === "num" && s.n > 0 && (
                          <>
                            <div className="flex gap-2 flex-wrap mb-2">
                              {[["Mean", s.mean.toFixed(2)], ["Median", s.median.toFixed(2)], ["Mode", s.mode ?? "-"], ["Std dev", s.sd.toFixed(2)], ["Min", s.min], ["Max", s.max]].map(([l, v]) => (
                                <span key={l as string} className="bg-well border border-line rounded-[8px] px-2.5 py-1.5 text-[12px]"><b className="mono text-ink">{v}</b> <span className="text-muted-2">{l}</span></span>
                              ))}
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: columnSVG(Object.keys(s.dist).sort((a, b) => Number(a) - Number(b)), Object.keys(s.dist).sort((a, b) => Number(a) - Number(b)).map((k) => s.dist[k])) }} />
                            <p className="text-[13px] text-muted mt-2">{numNarrative(q)}</p>
                          </>
                        )}
                        {s.kind === "text" && (
                          <div className="flex flex-col gap-1.5">
                            {s.samples.length ? s.samples.map((t, k) => <div key={k} className="bg-well rounded-[8px] px-3 py-2 text-[12.5px]">{t}</div>) : <div className="text-muted-2 text-[13px]">No responses.</div>}
                            {s.n > s.samples.length && <div className="mono text-[11px] text-muted-2">Showing {s.samples.length} of {s.n}.</div>}
                          </div>
                        )}
                        {s.n === 0 && <div className="text-muted-2 text-[13px]">No responses to this question yet.</div>}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* footer */}
              <div className="border-t border-line mt-8 pt-4 mono text-[10.5px] text-muted-2 flex justify-between">
                <span>AfriPoll Analytics &middot; Data. Insight. Impact.</span>
                <span>Generated {today}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          aside, .sticky { display: none !important; }
          body { background: #fff !important; }
          .report-doc { border: none !important; box-shadow: none !important; max-width: 100% !important; }
          main, .ml-64 { margin-left: 0 !important; }
        }
        .break-inside-avoid { break-inside: avoid; }
      `}</style>
    </ModuleShell>
  );
}

function Kpi({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="bg-well border border-line rounded-[10px] p-3">
      <div className="mono text-[9px] uppercase tracking-wide text-muted-2">{k}</div>
      <div className="font-display text-[22px] font-extrabold text-ink mt-0.5">{v}</div>
    </div>
  );
}
