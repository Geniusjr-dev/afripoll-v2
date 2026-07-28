"use client";
import { BQuestion } from "@/lib/builderTypes";
import { qtype, QTYPES, GROUP_LABELS, GROUP_ORDER } from "@/lib/questionTypes";

export default function PropertiesPanel({ q, onChange, onClose }: {
  q: BQuestion; onChange: (patch: Partial<BQuestion>) => void; onClose: () => void;
}) {
  const def = qtype(q.type);
  const field = "w-full text-[13px] border border-line rounded-[8px] px-2.5 py-2 focus:outline-none focus:border-blue";
  const lbl = "block mono text-[9px] tracking-wide uppercase text-muted-2 mb-1 mt-3";

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-line bg-surface min-h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-14 bg-surface z-10">
        <span className="kicker">Question settings</span>
        <button onClick={onClose} className="text-muted-2 hover:text-ink text-[15px]">x</button>
      </div>
      <div className="p-4">
        <label className={lbl}>Question text</label>
        <textarea value={q.label} onChange={(e) => onChange({ label: e.target.value })} rows={2} className={field} />

        <label className={lbl}>Description</label>
        <input value={q.description || ""} onChange={(e) => onChange({ description: e.target.value })} placeholder="Optional subtext" className={field} />

        <label className={lbl}>Question type</label>
        <select value={q.type} onChange={(e) => onChange({ type: e.target.value })} className={field}>
          {GROUP_ORDER.map((g) => (
            <optgroup key={g} label={GROUP_LABELS[g]}>
              {QTYPES.filter((t) => t.group === g).map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
        {def && def.build !== "ready" && (
          <div className={`mt-2 text-[11px] rounded-[7px] px-2.5 py-1.5 ${def.build === "collect" ? "bg-blue-soft text-blue" : "bg-[#fdf3f1] text-signal"}`}>
            {def.build === "collect" ? "Captured in the field by the Collect app." : "Logic runs during collection (engine coming)."}
          </div>
        )}

        <label className="flex items-center gap-2 mt-4 text-[13px] font-medium text-ink">
          <input type="checkbox" checked={q.required} onChange={(e) => onChange({ required: e.target.checked })} /> Required
        </label>

        {def?.scale && (
          <>
            <label className={lbl}>Scale</label>
            <div className="flex gap-2">
              <input type="number" value={q.config?.min ?? 1} onChange={(e) => onChange({ config: { ...q.config, min: Number(e.target.value) } })} className={field} placeholder="Min" />
              <input type="number" value={q.config?.max ?? 5} onChange={(e) => onChange({ config: { ...q.config, max: Number(e.target.value) } })} className={field} placeholder="Max" />
              {q.type === "slider" && <input type="number" value={q.config?.step ?? 1} onChange={(e) => onChange({ config: { ...q.config, step: Number(e.target.value) } })} className={field} placeholder="Step" />}
            </div>
          </>
        )}

        {(q.type === "number" || def?.scale) && (
          <>
            <label className={lbl}>Validation (min / max)</label>
            <div className="flex gap-2">
              <input type="number" value={q.validation?.min ?? ""} onChange={(e) => onChange({ validation: { ...q.validation, min: e.target.value === "" ? null : Number(e.target.value) } })} className={field} placeholder="Min" />
              <input type="number" value={q.validation?.max ?? ""} onChange={(e) => onChange({ validation: { ...q.validation, max: e.target.value === "" ? null : Number(e.target.value) } })} className={field} placeholder="Max" />
            </div>
          </>
        )}
        {(q.type === "short_text" || q.type === "long_text") && (
          <>
            <label className={lbl}>Max length</label>
            <input type="number" value={q.validation?.maxLength ?? ""} onChange={(e) => onChange({ validation: { ...q.validation, maxLength: e.target.value === "" ? null : Number(e.target.value) } })} className={field} placeholder="e.g. 200" />
          </>
        )}

        <label className={lbl}>Default value</label>
        <input value={q.defaultValue || ""} onChange={(e) => onChange({ defaultValue: e.target.value })} placeholder="Optional" className={field} />

        <label className={lbl}>Help text</label>
        <input value={q.help || ""} onChange={(e) => onChange({ help: e.target.value })} placeholder="Guidance shown to the enumerator" className={field} />

        <label className={lbl}>Visibility</label>
        <select value={q.visibility || "always"} onChange={(e) => onChange({ visibility: e.target.value as any })} className={field}>
          <option value="always">Always visible</option>
          <option value="hidden">Hidden by default</option>
        </select>

        {def?.hasOptions && (
          <label className="flex items-center gap-2 mt-4 text-[13px] font-medium text-ink">
            <input type="checkbox" checked={!!q.randomise} onChange={(e) => onChange({ randomise: e.target.checked })} /> Randomise option order
          </label>
        )}

        <div className="mt-4 border border-line rounded-[10px] p-3 bg-well">
          <div className="kicker mb-2">Skip logic</div>
          <p className="text-[11px] text-muted mb-2">Show or hide this question based on an earlier answer. Applied during collection.</p>
          <label className={lbl}>When question code</label>
          <input value={q.skip?.whenCode || ""} onChange={(e) => onChange({ skip: { ...(q.skip || {}), whenCode: e.target.value } })} placeholder="e.g. do_you_vote" className={field} />
          <label className={lbl}>Equals value</label>
          <input value={q.skip?.equals || ""} onChange={(e) => onChange({ skip: { ...(q.skip || {}), equals: e.target.value } })} placeholder="e.g. yes" className={field} />
          <label className={lbl}>Action</label>
          <select value={q.skip?.action || "show"} onChange={(e) => onChange({ skip: { ...(q.skip || {}), action: e.target.value as any } })} className={field}>
            <option value="show">Show this question</option>
            <option value="hide">Hide this question</option>
          </select>
        </div>

        <label className={lbl}>Translation</label>
        <div className="text-[11px] text-muted">Multi-language versions can be added later; the primary language is used now.</div>
      </div>
    </div>
  );
}
