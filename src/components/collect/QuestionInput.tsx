"use client";
import { qtype } from "@/lib/questionTypes";

// Renders an interactive input for any question type, bound to a value + onChange.
// value shapes: string | number | string[] (multi) | Record<row,val> (grid) | {points} (constant sum)
export default function QuestionInput({ q, value, onChange }: { q: any; value: any; onChange: (v: any) => void }) {
  const def = qtype(q.type);
  const base = "w-full text-[15px] border border-line rounded-[9px] px-3 py-2.5 focus:outline-none focus:border-blue";
  const opts: { code: string; label: string }[] = q.options || [];
  const cols: { code: string; label: string }[] = q.columns || [];

  // BASIC
  if (q.type === "short_text") return <input className={base} value={value || ""} maxLength={q.validation?.maxLength || undefined} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" />;
  if (q.type === "long_text") return <textarea className={base} rows={3} value={value || ""} maxLength={q.validation?.maxLength || undefined} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" />;
  if (q.type === "number") return <input type="number" className={base} value={value ?? ""} min={q.validation?.min ?? undefined} max={q.validation?.max ?? undefined} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder="0" />;
  if (q.type === "email") return <input type="email" className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="name@example.com" />;
  if (q.type === "phone") return <input type="tel" className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Phone number" />;
  if (q.type === "date") return <input type="date" className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "time") return <input type="time" className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} />;

  // SINGLE-CHOICE family (radio)
  const singleTypes = ["single_choice", "yes_no", "true_false", "dropdown", "party_selector", "candidate_selector", "region_selector", "district_selector", "constituency_selector", "polling_station_selector", "incident_type"];
  if (singleTypes.includes(q.type)) {
    if (q.type === "dropdown" || opts.length > 8) {
      return <select className={base} value={value || ""} onChange={(e) => onChange(e.target.value)}><option value="">Select...</option>{opts.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select>;
    }
    return (
      <div className="flex flex-col gap-1.5">
        {opts.map((o) => (
          <label key={o.code} className={`flex items-center gap-2.5 px-3 py-2 rounded-[9px] border cursor-pointer ${value === o.code ? "border-blue bg-blue-soft" : "border-line hover:border-muted-2"}`}>
            <input type="radio" checked={value === o.code} onChange={() => onChange(o.code)} /> <span className="text-[14px]">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  // MULTI-CHOICE family (checkbox)
  const multiTypes = ["multiple_choice", "observer_checklist", "poll_opening_checklist", "poll_closing_checklist"];
  if (multiTypes.includes(q.type)) {
    const arr: string[] = Array.isArray(value) ? value : [];
    const toggle = (c: string) => onChange(arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);
    return (
      <div className="flex flex-col gap-1.5">
        {opts.map((o) => (
          <label key={o.code} className={`flex items-center gap-2.5 px-3 py-2 rounded-[9px] border cursor-pointer ${arr.includes(o.code) ? "border-blue bg-blue-soft" : "border-line hover:border-muted-2"}`}>
            <input type="checkbox" checked={arr.includes(o.code)} onChange={() => toggle(o.code)} /> <span className="text-[14px]">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  // RATING scales that are option-labelled
  if (["likert", "satisfaction", "agreement"].includes(q.type)) {
    return (
      <div className="flex gap-2 flex-wrap">
        {opts.map((o) => (
          <button key={o.code} onClick={() => onChange(o.code)} className={`text-[12.5px] border rounded-full px-3.5 py-2 ${value === o.code ? "bg-blue text-white border-blue" : "border-line hover:border-blue"}`}>{o.label}</button>
        ))}
      </div>
    );
  }
  // Linear scale
  if (q.type === "rating") {
    const min = q.config?.min ?? 1, max = q.config?.max ?? 5;
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="flex gap-2 flex-wrap">
        {nums.map((n) => (
          <button key={n} onClick={() => onChange(n)} className={`w-11 h-11 rounded-full border mono text-[14px] ${value === n ? "bg-blue text-white border-blue" : "border-line hover:border-blue"}`}>{n}</button>
        ))}
      </div>
    );
  }
  if (q.type === "star_rating") {
    const max = q.config?.max ?? 5;
    return (
      <div className="flex gap-1 text-[28px]">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} className={n <= (value || 0) ? "text-gold" : "text-line"}>*</button>
        ))}
      </div>
    );
  }
  if (q.type === "slider") {
    const min = q.config?.min ?? 0, max = q.config?.max ?? 100, step = q.config?.step ?? 1;
    return (
      <div>
        <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
        <div className="mono text-[13px] text-blue text-center mt-1">{value ?? min}</div>
      </div>
    );
  }

  // ADVANCED
  if (q.type === "ranking") {
    const order: string[] = Array.isArray(value) && value.length ? value : opts.map((o) => o.code);
    const moveUp = (i: number) => { if (i === 0) return; const a = [...order]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); };
    return (
      <div className="flex flex-col gap-1.5">
        {order.map((code, i) => { const o = opts.find((x) => x.code === code); return (
          <div key={code} className="flex items-center gap-2 bg-well rounded-[8px] px-3 py-2">
            <span className="mono text-[13px] text-blue w-5">{i + 1}</span><span className="flex-1 text-[13.5px]">{o?.label || code}</span>
            <button onClick={() => moveUp(i)} className="text-muted text-[12px] px-1.5">up</button>
          </div>
        ); })}
      </div>
    );
  }
  if (["matrix", "mc_grid", "checkbox_grid"].includes(q.type)) {
    const val: Record<string, any> = value && typeof value === "object" ? value : {};
    const multi = q.type === "checkbox_grid";
    const setCell = (row: string, col: string) => {
      if (multi) { const cur: string[] = Array.isArray(val[row]) ? val[row] : []; onChange({ ...val, [row]: cur.includes(col) ? cur.filter((x) => x !== col) : [...cur, col] }); }
      else onChange({ ...val, [row]: col });
    };
    return (
      <table className="w-full text-[12.5px]">
        <thead><tr><th></th>{cols.map((c) => <th key={c.code} className="p-1.5 text-muted font-medium">{c.label}</th>)}</tr></thead>
        <tbody>{opts.map((r) => (
          <tr key={r.code}><td className="p-1.5">{r.label}</td>{cols.map((c) => {
            const on = multi ? (Array.isArray(val[r.code]) && val[r.code].includes(c.code)) : val[r.code] === c.code;
            return <td key={c.code} className="p-1.5 text-center"><button onClick={() => setCell(r.code, c.code)} className={`w-4 h-4 rounded-full border-2 ${on ? "bg-blue border-blue" : "border-muted-2"}`} /></td>;
          })}</tr>
        ))}</tbody>
      </table>
    );
  }
  if (q.type === "constant_sum") {
    const val: Record<string, number> = value && typeof value === "object" ? value : {};
    const total = Object.values(val).reduce((a, b) => a + (Number(b) || 0), 0);
    return (
      <div className="flex flex-col gap-1.5">
        {opts.map((o) => (
          <div key={o.code} className="flex items-center justify-between gap-3"><span className="text-[13.5px]">{o.label}</span>
            <input type="number" className="w-20 border border-line rounded px-2 py-1 text-right text-[13px]" value={val[o.code] ?? ""} onChange={(e) => onChange({ ...val, [o.code]: Number(e.target.value) })} /></div>
        ))}
        <div className={`mono text-[11px] text-right ${total === 100 ? "text-lime-deep" : "text-signal"}`}>total: {total} / 100</div>
      </div>
    );
  }
  if (["image_choice", "icon_choice"].includes(q.type)) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.code} onClick={() => onChange(o.code)} className={`border rounded-[9px] p-3 text-center text-[12px] ${value === o.code ? "border-blue bg-blue-soft" : "border-line"}`}>
            <div className="w-full h-14 bg-well rounded mb-1.5 grid place-items-center text-muted-2">{q.type === "icon_choice" ? "icon" : "img"}</div>{o.label}
          </button>
        ))}
      </div>
    );
  }

  // MEDIA / GPS - capture stubs (real capture wired later)
  if (def?.group === "media") {
    return (
      <div className="border-2 border-dashed border-line rounded-[10px] p-4">
        <div className="text-[13px] text-muted mb-2">{def.label} capture</div>
        <input className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={`Reference / filename for the ${def.label.toLowerCase()}`} />
        <div className="mono text-[10.5px] text-muted-2 mt-1.5">Full in-field capture is added with the mobile Collect layer.</div>
      </div>
    );
  }
  if (def?.group === "gps") {
    return (
      <div className="border-2 border-dashed border-line rounded-[10px] p-4">
        <button className="btn btn-ghost h-9 px-4 text-[13px]" onClick={() => {
          if (navigator.geolocation) navigator.geolocation.getCurrentPosition(
            (pos) => onChange(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
            () => onChange("unavailable"));
        }}>Capture location</button>
        {value && <div className="mono text-[12px] text-blue mt-2">{value}</div>}
      </div>
    );
  }

  // fallback
  return <input className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" />;
}
