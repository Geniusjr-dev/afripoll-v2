"use client";
import { useMemo, useState } from "react";
import { Question, summarise } from "@/lib/analytics";
import { tTest, anova, cronbachAlpha, correlation, pStars } from "@/lib/statistics";

const NUM = ["rating", "number", "star_rating", "slider"];
const CAT = ["single_choice", "yes_no", "true_false", "dropdown", "party_selector", "likert", "satisfaction", "agreement"];

export default function StatisticsSection({ questions, subs }: { questions: Question[]; subs: any[] }) {
  const numQs = questions.filter((q) => NUM.includes(q.type));
  const catQs = questions.filter((q) => CAT.includes(q.type));

  return (
    <div className="flex flex-col gap-7">
      <Descriptives numQs={numQs} subs={subs} />
      {numQs.length >= 2 && <CorrelationMatrix numQs={numQs} subs={subs} />}
      {numQs.length >= 1 && catQs.length >= 1 && <MeanComparison numQs={numQs} catQs={catQs} subs={subs} />}
      {numQs.length >= 2 && <Reliability numQs={numQs} subs={subs} />}
    </div>
  );
}

/* Descriptive statistics - clean research table */
function Descriptives({ numQs, subs }: { numQs: Question[]; subs: any[] }) {
  if (!numQs.length) return null;
  return (
    <div>
      <SectionLabel n="01" title="Descriptive statistics" sub="Central tendency and dispersion for scale variables" />
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="bg-well">
              {["Variable", "n", "M", "Mdn", "SD", "Min", "Max"].map((h, i) => (
                <th key={h} className={`py-2.5 px-3 mono text-[10px] uppercase tracking-wide text-muted-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numQs.map((q, i) => { const s = summarise(q, subs) as any;
              return (
                <tr key={q.code} className={i % 2 ? "bg-surface" : "bg-[#FCFDFE]"}>
                  <td className="py-2.5 px-3 text-ink font-medium">{q.label}</td>
                  <td className="py-2.5 px-3 text-right mono">{s.n}</td>
                  <td className="py-2.5 px-3 text-right mono font-semibold text-blue">{s.mean?.toFixed(2) ?? "-"}</td>
                  <td className="py-2.5 px-3 text-right mono">{s.median?.toFixed(2) ?? "-"}</td>
                  <td className="py-2.5 px-3 text-right mono">{s.sd?.toFixed(2) ?? "-"}</td>
                  <td className="py-2.5 px-3 text-right mono text-muted">{s.min ?? "-"}</td>
                  <td className="py-2.5 px-3 text-right mono text-muted">{s.max ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Note>M = mean, Mdn = median, SD = standard deviation.</Note>
    </div>
  );
}

/* Correlation matrix - heat-shaded cells */
function CorrelationMatrix({ numQs, subs }: { numQs: Question[]; subs: any[] }) {
  const items = numQs.slice(0, 8);
  const shade = (r: number) => { const a = Math.min(0.85, Math.abs(r) * 0.85 + 0.05); return r >= 0 ? `rgba(11,77,162,${a.toFixed(2)})` : `rgba(214,69,69,${a.toFixed(2)})`; };
  return (
    <div>
      <SectionLabel n="02" title="Correlation matrix" sub="Pearson r between scale variables" />
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full text-[12px] border-collapse">
          <thead><tr className="bg-well"><th className="py-2 px-3"></th>{items.map((q, i) => <th key={q.code} className="py-2 px-2 mono text-[10px] text-muted-2 font-semibold">{i + 1}</th>)}</tr></thead>
          <tbody>
            {items.map((qa, ri) => (
              <tr key={qa.code}>
                <td className="py-2 px-3 text-[11.5px] text-ink font-medium whitespace-nowrap">{ri + 1}. {qa.label.slice(0, 30)}</td>
                {items.map((qb, ci) => {
                  if (ci > ri) return <td key={qb.code} className="py-2 px-2"></td>;
                  if (ci === ri) return <td key={qb.code} className="py-2 px-2 text-center mono text-muted-2">-</td>;
                  const c = correlation(qa.code, qb.code, subs);
                  return <td key={qb.code} className="py-2 px-2 text-center mono font-semibold" style={{ background: shade(c.r), color: Math.abs(c.r) > 0.5 ? "#fff" : "#0B2647" }}>{c.r.toFixed(2)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>Blue = positive association, red = negative. Deeper shade = stronger relationship.</Note>
    </div>
  );
}

/* Mean comparison: t-test (2 groups) or ANOVA (3+) of a scale var across a categorical var */
function MeanComparison({ numQs, catQs, subs }: { numQs: Question[]; catQs: Question[]; subs: any[] }) {
  const [numCode, setNumCode] = useState(numQs[0].code);
  const [catCode, setCatCode] = useState(catQs[0].code);
  const numQ = numQs.find((q) => q.code === numCode)!;
  const catQ = catQs.find((q) => q.code === catCode)!;

  const result = useMemo(() => {
    const groupsMap: Record<string, number[]> = {};
    subs.forEach((s) => { const g = String(s?.payload?.[catCode] ?? ""); const v = Number(s?.payload?.[numCode]); if (g && !isNaN(v)) { (groupsMap[g] ||= []).push(v); } });
    const labelFor = (code: string) => (catQ.options?.find((o: any) => o.code === code)?.label) || code;
    const groups = Object.entries(groupsMap).map(([code, values]) => ({ label: labelFor(code), values }));
    if (groups.length === 2) { const tt = tTest(groups[0].values, groups[1].values); return { kind: "t" as const, tt, groups }; }
    if (groups.length >= 3) { const av = anova(groups); return { kind: "anova" as const, av, groups }; }
    return { kind: "none" as const, groups };
  }, [numCode, catCode, subs]);

  const sel = "text-[12px] border border-line rounded-[8px] px-2.5 py-1.5 bg-surface focus:outline-none focus:border-blue";
  return (
    <div>
      <SectionLabel n="03" title="Mean comparison" sub="Compare a scale variable across groups (t-test / ANOVA)" />
      <div className="no-print flex flex-wrap gap-2 mb-3 items-end">
        <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1">Scale variable</label><select value={numCode} onChange={(e) => setNumCode(e.target.value)} className={sel}>{numQs.map((q) => <option key={q.code} value={q.code}>{q.label.slice(0, 36)}</option>)}</select></div>
        <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1">Grouping variable</label><select value={catCode} onChange={(e) => setCatCode(e.target.value)} className={sel}>{catQs.map((q) => <option key={q.code} value={q.code}>{q.label.slice(0, 36)}</option>)}</select></div>
      </div>

      {result.kind === "none" && <p className="text-muted-2 text-[13px]">Need at least two groups with data to compare.</p>}

      {result.kind === "t" && result.tt && (
        <div className="rounded-[12px] border border-line overflow-hidden">
          <div className="grid grid-cols-2">
            {result.groups.map((g, i) => (
              <div key={i} className={`p-4 ${i === 0 ? "border-r border-line" : ""}`}>
                <div className="mono text-[10px] uppercase text-muted-2 mb-1">{g.label}</div>
                <div className="font-display text-[26px] font-extrabold text-ink">{(result.tt!.mean1 !== undefined && i === 0 ? result.tt!.mean1 : result.tt!.mean2).toFixed(2)}</div>
                <div className="mono text-[10px] text-muted-2">n = {i === 0 ? result.tt!.n1 : result.tt!.n2}</div>
              </div>
            ))}
          </div>
          <ResultBar sig={result.tt.p < 0.05} text={`t(${result.tt.df.toFixed(1)}) = ${result.tt.t.toFixed(2)}, ${pStars(result.tt.p)}`}
            interp={result.tt.p < 0.05 ? `The difference between groups is statistically significant.` : `No statistically significant difference between groups.`} />
        </div>
      )}

      {result.kind === "anova" && result.av && (
        <div className="rounded-[12px] border border-line overflow-hidden">
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {result.av.groups.map((g) => (
                <div key={g.label} className="bg-well rounded-[9px] px-3 py-2 border border-line">
                  <div className="mono text-[9.5px] uppercase text-muted-2">{g.label}</div>
                  <div className="font-display text-[18px] font-bold text-ink">{g.mean.toFixed(2)}</div>
                  <div className="mono text-[9px] text-muted-2">n={g.n}</div>
                </div>
              ))}
            </div>
          </div>
          <ResultBar sig={result.av.p < 0.05} text={`F(${result.av.df1}, ${result.av.df2}) = ${result.av.F.toFixed(2)}, ${pStars(result.av.p)}`}
            interp={result.av.p < 0.05 ? `At least one group mean differs significantly (one-way ANOVA).` : `Group means do not differ significantly (one-way ANOVA).`} />
        </div>
      )}
    </div>
  );
}

function Reliability({ numQs, subs }: { numQs: Question[]; subs: any[] }) {
  const vectors = numQs.map((q) => subs.map((s) => Number(s?.payload?.[q.code])).filter((v) => !isNaN(v)));
  const minN = Math.min(...vectors.map((v) => v.length));
  const aligned = numQs.map((q) => subs.filter((s) => numQs.every((qq) => !isNaN(Number(s?.payload?.[qq.code])))).map((s) => Number(s?.payload?.[q.code])));
  const ca = cronbachAlpha(aligned);
  if (!ca.valid) return null;
  const rating = ca.alpha >= 0.9 ? "Excellent" : ca.alpha >= 0.8 ? "Good" : ca.alpha >= 0.7 ? "Acceptable" : ca.alpha >= 0.6 ? "Questionable" : "Poor";
  return (
    <div>
      <SectionLabel n="04" title="Scale reliability" sub="Internal consistency across scale items" />
      <div className="rounded-[12px] border border-line p-5 flex items-center gap-6">
        <div>
          <div className="mono text-[10px] uppercase text-muted-2 mb-1">Cronbach's alpha</div>
          <div className="font-display text-[40px] font-extrabold leading-none text-blue">{ca.alpha.toFixed(2)}</div>
        </div>
        <div className="flex-1">
          <div className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold mb-2" style={{ background: ca.alpha >= 0.7 ? "#EEF6E2" : "#FBEAEA", color: ca.alpha >= 0.7 ? "#6FA82C" : "#D64545" }}>{rating}</div>
          <p className="text-[12.5px] text-muted">Based on {ca.k} scale items across {minN} complete responses. Values of 0.70 and above indicate acceptable internal consistency for research use.</p>
        </div>
      </div>
    </div>
  );
}

/* shared presentation bits */
function SectionLabel({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="mono text-[11px] text-lime-deep font-semibold">{n}</span>
      <div><h3 className="text-[15px] font-bold text-ink leading-tight">{title}</h3><p className="text-[11.5px] text-muted-2">{sub}</p></div>
    </div>
  );
}
function ResultBar({ sig, text, interp }: { sig: boolean; text: string; interp: string }) {
  return (
    <div className="border-t border-line" style={{ background: sig ? "#F3F8EC" : "#F7F9FB" }}>
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sig ? "#8DC63F" : "#94A3B4" }} />
        <div>
          <div className="mono text-[12px] font-semibold text-ink">{text}</div>
          <div className="text-[12px] text-muted mt-0.5">{interp}</div>
        </div>
      </div>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <p className="mono text-[10.5px] text-muted-2 mt-2 italic">{children}</p>;
}
