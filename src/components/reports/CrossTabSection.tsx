"use client";
import { useMemo, useState } from "react";
import { Question } from "@/lib/analytics";
import { crossTab, pStars } from "@/lib/statistics";

const CATEGORICAL = ["single_choice", "multiple_choice", "dropdown", "yes_no", "true_false", "likert", "satisfaction", "agreement", "party_selector", "region_selector", "constituency_selector"];

export default function CrossTabSection({ questions, subs }: { questions: Question[]; subs: any[] }) {
  const cats = questions.filter((q) => CATEGORICAL.includes(q.type));
  const [rowCode, setRowCode] = useState(cats[0]?.code || "");
  const [colCode, setColCode] = useState(cats[1]?.code || cats[0]?.code || "");
  const [mode, setMode] = useState<"count" | "colpct" | "rowpct">("colpct");

  const rowQ = cats.find((q) => q.code === rowCode);
  const colQ = cats.find((q) => q.code === colCode);
  const ct = useMemo(() => (rowQ && colQ ? crossTab(rowQ, colQ, subs) : null), [rowQ, colQ, subs]);

  if (cats.length < 2) return <p className="text-muted text-[13px]">Cross-tabulation needs at least two categorical questions.</p>;

  return (
    <div>
      <div className="no-print flex flex-wrap gap-2 mb-4 items-end">
        <Field label="Rows"><select value={rowCode} onChange={(e) => setRowCode(e.target.value)} className={sel}>{cats.map((q) => <option key={q.code} value={q.code}>{q.label.slice(0, 40)}</option>)}</select></Field>
        <Field label="Columns"><select value={colCode} onChange={(e) => setColCode(e.target.value)} className={sel}>{cats.map((q) => <option key={q.code} value={q.code}>{q.label.slice(0, 40)}</option>)}</select></Field>
        <Field label="Show"><select value={mode} onChange={(e) => setMode(e.target.value as any)} className={sel}><option value="count">Counts</option><option value="colpct">% of column</option><option value="rowpct">% of row</option></select></Field>
      </div>

      {ct && ct.valid ? (
        <>
          <div className="text-[13px] font-semibold text-ink mb-1">{rowQ!.label} <span className="text-muted-2">by</span> {colQ!.label}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="text-left p-2 mono text-[10px] uppercase text-muted-2"></th>
                  {ct.colLabels.map((c, j) => <th key={j} className="p-2 text-right mono text-[10px] uppercase text-muted-2">{c}</th>)}
                  <th className="p-2 text-right mono text-[10px] uppercase text-muted-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {ct.rowLabels.map((rl, i) => (
                  <tr key={i} className="border-b border-line-2">
                    <td className="p-2 font-medium text-ink">{rl}</td>
                    {ct.colLabels.map((_, j) => (
                      <td key={j} className="p-2 text-right mono">
                        {mode === "count" ? ct.counts[i][j] : mode === "colpct" ? ct.colPct[i][j].toFixed(1) + "%" : ct.rowPct[i][j].toFixed(1) + "%"}
                      </td>
                    ))}
                    <td className="p-2 text-right mono font-semibold">{ct.rowTotals[i]}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink font-semibold">
                  <td className="p-2 mono text-[11px]">Total</td>
                  {ct.colTotals.map((t, j) => <td key={j} className="p-2 text-right mono">{t}</td>)}
                  <td className="p-2 text-right mono">{ct.grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 bg-well rounded-[9px] p-3 text-[12px]">
            <b className="text-ink">Chi-square test:</b> <span className="mono">X2({ct.df}) = {ct.chi2.toFixed(2)}</span>, <span className="mono">{pStars(ct.pValue)}</span>, <span className="mono">Cramer's V = {ct.cramersV.toFixed(3)}</span>
            {ct.note && <div className="text-signal text-[11px] mt-1">{ct.note}</div>}
          </div>
        </>
      ) : <p className="text-muted-2 text-[13px]">Not enough data to cross-tabulate these two questions.</p>}
    </div>
  );
}

const sel = "text-[12.5px] border border-line rounded-[8px] px-2.5 py-2 bg-surface focus:outline-none focus:border-blue";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block mono text-[9px] uppercase text-muted-2 mb-1">{label}</label>{children}</div>;
}
