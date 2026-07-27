"use client";
import { useState } from "react";
import { useParams, notFound } from "next/navigation";
import { useRouter } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { useModuleData } from "@/lib/moduleData";
import { supabase } from "@/lib/supabase";

export default function StudiesPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const router = useRouter();
  const { profile, projects, activeStudyId, setActiveStudy, refresh } = useWorkspace();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!mod) return notFound();
  const studies = projects.filter((p) => p.project_type === mod.type);
  const ids = studies.map((s) => s.id);
  const d = useModuleData(ids);
  const base = `/modules/${slug}`;

  const respFor = (pid: string) => d.subs.filter((s) => s.project_id === pid).length;
  const liveFor = (pid: string) => d.qn.filter((q) => q.project_id === pid && q.status === "published").length;
  const qnFor = (pid: string) => d.qn.filter((q) => q.project_id === pid).length;
  const lastFor = (pid: string) => {
    const rows = d.subs.filter((s) => s.project_id === pid).map((s) => s.captured_at).filter(Boolean).sort();
    return rows.length ? rows[rows.length - 1] : null;
  };
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "no data yet";

  async function createStudy() {
    setErr("");
    if (!name.trim()) { setErr("Give the study a name."); return; }
    setBusy(true);
    try {
      const row = {
        organization_id: profile?.organization_id || null,
        name: name.trim(),
        project_type: mod!.type,               // locked to this module (ADR invariant #3)
        description: desc.trim() || null,
        collection_starts: start || null,
        collection_ends: end || null,
        status: "active",
      };
      const { data, error } = await supabase().from("projects").insert(row).select().single();
      if (error) { setErr("Error: " + error.message); setBusy(false); return; }
      await refresh();
      if (data) setActiveStudy(data.id);
      setShowNew(false); setName(""); setDesc(""); setStart(""); setEnd("");
    } catch (e: any) { setErr("Could not create study. " + (e?.message || "")); }
    setBusy(false);
  }

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Studies`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="kicker mb-1">{mod.label}</div>
          <h1 className="text-[26px] font-extrabold text-ink">Studies</h1>
          <p className="text-muted text-[13.5px] mt-1">{studies.length} {studies.length === 1 ? "study" : "studies"} in this module. New studies are created as {mod.label} studies.</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowNew((v) => !v)}>+ New study</button>
      </div>

      {showNew && (
        <div className="card card-accent p-6 mb-5">
          <h2 className="text-[18px] font-bold text-ink mb-1">Create a new {mod.label} study</h2>
          <p className="mono text-[11px] text-blue mb-4">Type is set to {mod.label} automatically. A study groups its questionnaires, responses, team and reports.</p>
          <label className="block text-[11px] font-semibold text-muted mb-1.5">Study name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ashanti MP Assessment 2026"
            className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5">Coverage note (optional)</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. National, all 16 regions"
                className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5">Fieldwork start</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5">Fieldwork end</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="btn btn-accent h-10 px-4 text-[14px]" onClick={createStudy} disabled={busy}>{busy ? "Creating..." : "Create study"}</button>
            <button className="btn btn-ghost h-10 px-4 text-[14px]" onClick={() => { setShowNew(false); setErr(""); }}>Cancel</button>
            <span className="text-signal text-[13px]">{err}</span>
          </div>
        </div>
      )}

      {studies.length === 0 ? (
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">Empty module</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">No studies yet</h2>
          <p className="text-muted text-[14px] max-w-md mx-auto mb-5">Create your first {mod.label} study to start building questionnaires and collecting responses.</p>
          <button className="btn btn-accent inline-flex" onClick={() => setShowNew(true)}>+ New study</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {studies.map((s) => {
            const on = s.id === activeStudyId;
            const live = liveFor(s.id);
            return (
              <div key={s.id} className={`card p-5 ${on ? "ring-2 ring-lime" : ""}`}>
                <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: on ? "#8DC63F" : mod.colour }} />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-bold text-ink">{s.name}</h3>
                      {on && <span className="mono text-[9px] text-lime-deep border border-[#cfe6ad] bg-lime-soft rounded-full px-2 py-0.5">ACTIVE</span>}
                    </div>
                    {s.description && <p className="text-[12.5px] text-muted mt-0.5">{s.description}</p>}
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 ${live ? "bg-blue" : "bg-muted-2"}`} title={live ? "collecting" : "not live"} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-well rounded-[9px] p-2.5"><div className="font-display font-extrabold text-[18px] text-blue">{respFor(s.id)}</div><div className="text-[10px] text-muted">responses</div></div>
                  <div className="bg-well rounded-[9px] p-2.5"><div className="font-display font-extrabold text-[18px] text-blue">{qnFor(s.id)}</div><div className="text-[10px] text-muted">questionnaires</div></div>
                  <div className="bg-well rounded-[9px] p-2.5"><div className="font-display font-extrabold text-[18px] text-blue">{live}</div><div className="text-[10px] text-muted">live now</div></div>
                </div>
                <div className="mono text-[10.5px] text-muted-2 mb-3">Last response: {fmt(lastFor(s.id))}</div>
                <div className="flex items-center gap-2">
                  {on ? (
                    <button className="btn h-9 px-3.5 text-[13px]" onClick={() => router.push(`${base}/dashboard`)}>Open dashboard</button>
                  ) : (
                    <button className="btn btn-accent h-9 px-3.5 text-[13px]" onClick={() => setActiveStudy(s.id)}>Set active</button>
                  )}
                  <button className="btn btn-ghost h-9 px-3.5 text-[13px]" onClick={() => { setActiveStudy(s.id); router.push(`${base}/builder`); }}>Builder</button>
                  <button className="btn btn-ghost h-9 px-3.5 text-[13px]" onClick={() => { setActiveStudy(s.id); router.push(`${base}/reports`); }}>Reports</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModuleShell>
  );
}
