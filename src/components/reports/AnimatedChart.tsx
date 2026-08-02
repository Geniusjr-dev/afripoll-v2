"use client";
import { useEffect, useRef, useState } from "react";
import { summarise, Question, hbarSVG } from "@/lib/analytics";

// 4D animated chart: plays how a question's responses accumulate over the fieldwork timeline.
// Splits submissions into time steps by captured_at, and animates the bar chart cumulatively.
export default function AnimatedChart({ q, subs }: { q: Question; subs: any[] }) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const timer = useRef<any>(null);

  // build sorted unique days
  const days = Array.from(new Set(subs.map((s) => (s.captured_at || "").slice(0, 10)).filter(Boolean))).sort();
  const steps = days.length || 1;

  useEffect(() => {
    if (!playing) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => {
      setStep((p) => { if (p >= steps - 1) { setPlaying(false); return p; } return p + 1; });
    }, 900);
    return () => timer.current && clearInterval(timer.current);
  }, [playing, steps]);

  // subs up to and including the current day
  const upto = days[Math.min(step, steps - 1)];
  const cumulative = subs.filter((s) => (s.captured_at || "").slice(0, 10) <= (upto || "9999"));
  const s = summarise(q, cumulative);
  const svg = s.kind === "choice" ? hbarSVG(s.rows) : "";

  return (
    <div className="border border-line rounded-[12px] overflow-hidden bg-surface">
      <div className="flex items-center gap-3 px-3 py-2 bg-well border-b border-line">
        <button onClick={() => { if (step >= steps - 1) setStep(0); setPlaying((p) => !p); }} className="mono text-[10px] uppercase px-2.5 h-7 rounded border bg-surface border-line text-blue hover:border-blue">{playing ? "Pause" : "Play"}</button>
        <button onClick={() => { setPlaying(false); setStep(0); }} className="mono text-[10px] uppercase px-2 h-7 rounded border bg-surface border-line text-muted">Reset</button>
        <input type="range" min={0} max={steps - 1} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} className="flex-1" />
        <span className="mono text-[10.5px] text-ink whitespace-nowrap">{upto || "-"}</span>
      </div>
      <div className="p-3">
        <div className="mono text-[10px] text-muted-2 mb-1">Cumulative to {upto || "-"} &middot; {cumulative.length} of {subs.length} responses</div>
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="text-muted-2 text-[12px] py-6 text-center">Animation is available for choice questions.</div>}
      </div>
    </div>
  );
}
