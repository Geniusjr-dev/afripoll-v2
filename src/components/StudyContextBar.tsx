"use client";
import { useState } from "react";
import { useWorkspace, Project } from "@/lib/workspace";

// Shows the active study within a module and lets the user switch it.
// Selecting a study sets it as the active context (drives Dashboard/Builder/Collect/Reports).
export default function StudyContextBar({ studies }: { studies: Project[] }) {
  const { activeStudyId, setActiveStudy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const active = studies.find((s) => s.id === activeStudyId) || null;

  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="mono text-[11px] tracking-[.1em] uppercase text-muted-2">Active study</span>
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 bg-surface border border-line rounded-[11px] px-3.5 py-2.5 font-display font-semibold text-[15px] text-ink shadow-card hover:border-blue">
          <span className="w-6 h-6 rounded-full bg-blue-soft text-blue grid place-items-center text-[12px] font-bold">
            {active ? active.name.slice(0, 1).toUpperCase() : "-"}
          </span>
          {active ? active.name : "No study selected"}
          <span className="text-muted-2 text-[11px]">v</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-[52px] left-0 min-w-[280px] bg-surface border border-line rounded-[12px] shadow-[0_20px_50px_-16px_rgba(11,38,71,.35)] p-1.5 z-50">
              {studies.length === 0 && (
                <div className="px-3 py-2.5 text-muted-2 text-[13px]">No studies in this module yet.</div>
              )}
              {studies.map((s) => {
                const on = s.id === activeStudyId;
                return (
                  <button key={s.id}
                    onClick={() => { setActiveStudy(s.id); setOpen(false); }}
                    className={`block w-full text-left rounded-[8px] px-3 py-2.5 ${on ? "bg-blue-soft" : "hover:bg-well"}`}>
                    <b className={`block text-[13.5px] font-semibold ${on ? "text-blue" : "text-ink"}`}>{s.name}</b>
                    <small className="mono text-[10px] text-muted-2">{on ? "active" : "select"}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
