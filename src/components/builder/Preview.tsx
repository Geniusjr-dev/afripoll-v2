"use client";
import { BDefinition, BQuestion } from "@/lib/builderTypes";
import { qtype } from "@/lib/questionTypes";
import { useState } from "react";

export default function Preview({ def, onClose }: { def: BDefinition; onClose: () => void }) {
  const pages = Math.max(1, def.pageTitles.length);
  const [page, setPage] = useState(0);
  const sectionsOnPage = def.sections.filter((s) => (s.page || 0) === page);

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 grid place-items-start justify-center overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-paper rounded-[16px] max-w-[720px] w-full shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface rounded-t-[16px]">
          <div>
            <div className="kicker">Preview</div>
            <h2 className="text-[18px] font-bold text-ink">{def.title}</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost h-9 px-4 text-[13px]">Close</button>
        </div>

        {pages > 1 && (
          <div className="flex items-center gap-2 px-6 pt-4 flex-wrap">
            {def.pageTitles.map((pt, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`mono text-[11px] px-3 h-8 rounded-full border ${i === page ? "bg-blue text-white border-blue" : "bg-surface border-line text-muted"}`}>
                {i + 1}. {pt || "Page " + (i + 1)}
              </button>
            ))}
          </div>
        )}

        <div className="p-6 flex flex-col gap-5">
          {sectionsOnPage.length === 0 && <div className="text-muted-2 text-[13px] text-center py-8">No questions on this page.</div>}
          {sectionsOnPage.map((s) => (
            <div key={s.id}>
              <div className="border-l-4 border-lime pl-3 mb-3">
                <h3 className="text-[16px] font-bold text-ink">{s.title}</h3>
                {s.description && <p className="text-[12.5px] text-muted">{s.description}</p>}
              </div>
              <div className="flex flex-col gap-4">
                {s.questions.map((q, i) => <PreviewQuestion key={q.id} q={q} n={i + 1} />)}
              </div>
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-line">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn btn-ghost h-9 px-4 text-[13px] disabled:opacity-40">Back</button>
            <span className="mono text-[11px] text-muted-2">Page {page + 1} of {pages}</span>
            <button disabled={page === pages - 1} onClick={() => setPage((p) => p + 1)} className="btn h-9 px-4 text-[13px] disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewQuestion({ q, n }: { q: BQuestion; n: number }) {
  const def = qtype(q.type);
  const inputCls = "w-full text-[14px] border border-line rounded-[8px] px-3 py-2.5 bg-surface";
  return (
    <div className="bg-surface border border-line rounded-[11px] p-4">
      <div className="text-[14px] font-semibold text-ink mb-1">{n}. {q.label} {q.required && <span className="text-signal">*</span>}</div>
      {q.description && <div className="text-[12px] text-muted mb-2">{q.description}</div>}

      {["short_text", "email", "phone"].includes(q.type) && <input disabled placeholder={q.type === "email" ? "name@example.com" : "Your answer"} className={inputCls} />}
      {q.type === "long_text" && <textarea disabled placeholder="Your answer" rows={3} className={inputCls} />}
      {q.type === "number" && <input disabled type="number" placeholder="0" className={inputCls} />}
      {q.type === "date" && <input disabled type="date" className={inputCls} />}
      {q.type === "time" && <input disabled type="time" className={inputCls} />}

      {["single_choice", "yes_no", "true_false", "party_selector", "candidate_selector", "region_selector", "district_selector", "constituency_selector", "polling_station_selector", "incident_type"].includes(q.type) && (
        <div className="flex flex-col gap-1.5">
          {(q.options.length ? q.options : [{ code: "x", label: "(options set at collection)" }]).map((o) => (
            <label key={o.code} className="flex items-center gap-2 text-[13px]"><span className="w-4 h-4 rounded-full border-2 border-muted-2" /> {o.label}</label>
          ))}
        </div>
      )}
      {["multiple_choice", "observer_checklist", "poll_opening_checklist", "poll_closing_checklist"].includes(q.type) && (
        <div className="flex flex-col gap-1.5">
          {q.options.map((o) => (
            <label key={o.code} className="flex items-center gap-2 text-[13px]"><span className="w-4 h-4 rounded border-2 border-muted-2" /> {o.label}</label>
          ))}
        </div>
      )}
      {q.type === "dropdown" && (
        <select disabled className={inputCls}><option>Select...</option>{q.options.map((o) => <option key={o.code}>{o.label}</option>)}</select>
      )}
      {["likert", "satisfaction", "agreement"].includes(q.type) && (
        <div className="flex gap-2 flex-wrap">
          {q.options.map((o) => <span key={o.code} className="text-[12px] border border-line rounded-full px-3 py-1.5">{o.label}</span>)}
        </div>
      )}
      {(q.type === "rating") && (
        <div className="flex gap-2">
          {Array.from({ length: (q.config?.max ?? 5) - (q.config?.min ?? 1) + 1 }).map((_, i) => (
            <span key={i} className="w-9 h-9 rounded-full border border-line grid place-items-center text-[13px] mono">{(q.config?.min ?? 1) + i}</span>
          ))}
        </div>
      )}
      {q.type === "star_rating" && <div className="text-[22px] text-gold tracking-widest">{"*".repeat(q.config?.max ?? 5)}</div>}
      {q.type === "slider" && <input disabled type="range" min={q.config?.min ?? 0} max={q.config?.max ?? 100} className="w-full" />}

      {["matrix", "mc_grid", "checkbox_grid"].includes(q.type) && (
        <table className="w-full text-[12px] mt-1">
          <thead><tr><th></th>{(q.columns || []).map((c) => <th key={c.code} className="p-1.5 text-muted font-medium">{c.label}</th>)}</tr></thead>
          <tbody>{q.options.map((r) => (
            <tr key={r.code}><td className="p-1.5 text-ink">{r.label}</td>{(q.columns || []).map((c) => <td key={c.code} className="p-1.5 text-center"><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-muted-2" /></td>)}</tr>
          ))}</tbody>
        </table>
      )}
      {q.type === "ranking" && (
        <div className="flex flex-col gap-1.5">{q.options.map((o, i) => <div key={o.code} className="flex items-center gap-2 text-[13px] bg-well rounded-[7px] px-2.5 py-1.5"><span className="mono text-muted-2">{i + 1}</span> {o.label}</div>)}</div>
      )}
      {q.type === "constant_sum" && (
        <div className="flex flex-col gap-1.5">{q.options.map((o) => <div key={o.code} className="flex items-center justify-between text-[13px]"><span>{o.label}</span><input disabled className="w-16 border border-line rounded px-2 py-1 text-right" placeholder="0" /></div>)}<div className="mono text-[11px] text-muted-2 text-right">total must sum to 100</div></div>
      )}
      {["image_choice", "icon_choice"].includes(q.type) && (
        <div className="grid grid-cols-3 gap-2">{q.options.map((o) => <div key={o.code} className="border border-line rounded-[9px] p-3 text-center text-[12px]"><div className="w-full h-14 bg-well rounded mb-1.5 grid place-items-center text-muted-2">{q.type === "icon_choice" ? "icon" : "img"}</div>{o.label}</div>)}</div>
      )}

      {def?.group === "media" && <div className="border-2 border-dashed border-line rounded-[10px] p-5 text-center text-[12px] text-muted-2">{def.label} - captured in the field</div>}
      {def?.group === "gps" && <div className="border-2 border-dashed border-line rounded-[10px] p-5 text-center text-[12px] text-muted-2">{def.label} - captured in the field</div>}

      {q.help && <div className="mono text-[11px] text-muted-2 mt-2">{q.help}</div>}
    </div>
  );
}
