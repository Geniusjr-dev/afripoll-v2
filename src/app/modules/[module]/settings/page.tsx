"use client";
import { useEffect, useState } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import StudyContextBar from "@/components/StudyContextBar";

const STATUSES = [
  { v: "active", label: "Active", note: "Collection is open." },
  { v: "paused", label: "Paused", note: "Temporarily halted." },
  { v: "closed", label: "Closed", note: "Collection finished." },
  { v: "archived", label: "Archived", note: "Hidden from active lists." },
];

export default function SettingsPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const router = useRouter();
  const { user, profile, projects, activeStudyId, refresh } = useWorkspace();
  const studies = mod ? projects.filter((p) => p.project_type === mod.type) : [];
  const study = studies.find((p) => p.id === activeStudyId) || null;
  const canManage = ["super_admin", "org_admin", "project_manager", "supervisor"].includes(profile?.role || "");

  if (!mod) return notFound();

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Settings`}>
      <div className="mb-5">
        <div className="kicker mb-1">Settings</div>
        <h1 className="text-[24px] font-extrabold text-ink">Study settings</h1>
      </div>
      <StudyContextBar studies={studies} />

      {!study ? (
        <div className="card card-accent p-8 text-center mt-5">
          <p className="text-muted text-[14px]">Select a study above to manage its settings.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-5 max-w-[760px]">
          <StudyDetails study={study} canManage={canManage} onSaved={refresh} />
          <StudyStatus study={study} canManage={canManage} onSaved={refresh} />
          <ResponseManagement studyId={study.id} />
          {canManage && <DangerZone study={study} userId={user?.id || ""} onDeleted={() => { refresh(); router.push(`/modules/${slug}/studies`); }} />}
        </div>
      )}
    </ModuleShell>
  );
}

function Card({ title, desc, children, danger }: { title: string; desc?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`card p-5 ${danger ? "border-signal/40" : ""}`}>
      <h2 className={`text-[16px] font-bold mb-1 ${danger ? "text-signal" : "text-ink"}`}>{title}</h2>
      {desc && <p className="text-[12.5px] text-muted mb-4">{desc}</p>}
      {children}
    </div>
  );
}

function StudyDetails({ study, canManage, onSaved }: any) {
  const [name, setName] = useState(study.name || "");
  const [description, setDescription] = useState(study.description || "");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  useEffect(() => { setName(study.name || ""); setDescription(study.description || ""); }, [study.id]);

  const dirty = name !== (study.name || "") || description !== (study.description || "");
  async function save() {
    setBusy(true); setMsg("");
    const { error } = await supabase().from("projects").update({ name, description }).eq("id", study.id);
    if (error) setMsg(error.message); else { setMsg("Saved."); onSaved(); }
    setBusy(false);
  }
  const fld = "w-full text-[14px] border border-line rounded-[9px] px-3 py-2.5 focus:outline-none focus:border-blue";
  return (
    <Card title="Study details" desc="The name and description shown across the module and on report covers.">
      <label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Study name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} className={fld} />
      <label className="block mono text-[9px] uppercase text-muted-2 mb-1.5 mt-3">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={3} className={fld} placeholder="A short description of this study" />
      {canManage && (
        <div className="flex items-center gap-3 mt-3">
          <button onClick={save} disabled={busy || !dirty} className="btn btn-accent disabled:opacity-40">{busy ? "Saving..." : "Save changes"}</button>
          {msg && <span className={`text-[13px] ${msg === "Saved." ? "text-lime-deep" : "text-signal"}`}>{msg}</span>}
        </div>
      )}
    </Card>
  );
}

function StudyStatus({ study, canManage, onSaved }: any) {
  const [status, setStatus] = useState(study.status || "active");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  useEffect(() => { setStatus(study.status || "active"); }, [study.id]);
  async function setTo(v: string) {
    if (!canManage) return;
    setStatus(v); setBusy(true); setMsg("");
    const { error } = await supabase().from("projects").update({ status: v }).eq("id", study.id);
    if (error) setMsg(error.message); else { setMsg("Updated."); onSaved(); }
    setBusy(false);
  }
  return (
    <Card title="Study status" desc="Controls whether this study is open for collection.">
      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map((s) => (
          <button key={s.v} onClick={() => setTo(s.v)} disabled={!canManage || busy}
            className={`text-left border rounded-[10px] p-3 transition ${status === s.v ? "border-blue bg-blue-soft" : "border-line hover:border-blue/40"}`}>
            <div className={`text-[13.5px] font-semibold ${status === s.v ? "text-blue" : "text-ink"}`}>{s.label}</div>
            <div className="text-[11px] text-muted-2 mt-0.5">{s.note}</div>
          </button>
        ))}
      </div>
      {msg && <div className={`text-[12.5px] mt-2 ${msg === "Updated." ? "text-lime-deep" : "text-signal"}`}>{msg}</div>}
    </Card>
  );
}

function ResponseManagement({ studyId }: { studyId: string }) {
  const [subs, setSubs] = useState<any[] | null>(null);
  const [geo, setGeo] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState("");

  async function load() {
    const sb = supabase();
    const [subsR, geoR] = await Promise.all([
      sb.from("submissions").select("client_id, captured_at, geo_unit_id, status, enumerator_id").eq("project_id", studyId).order("captured_at", { ascending: false }),
      sb.from("geo_units").select("id,name,level,parent_id"),
    ]);
    const gidx: Record<string, any> = {}; (geoR.data || []).forEach((g: any) => (gidx[g.id] = g));
    setGeo(gidx); setSubs(subsR.data || []);
  }
  useEffect(() => { load(); }, [studyId]);

  async function del(id: string) {
    setBusy(id);
    const sb = supabase();
    try { await sb.from("submission_flags").delete().eq("submission_id", id); } catch {}
    const { error } = await sb.from("submissions").delete().eq("client_id", id);
    if (!error) setSubs((prev) => (prev || []).filter((s) => s.client_id !== id));
    setBusy("");
  }
  const nameOf = (id: string) => geo[id]?.name || "Unknown";

  return (
    <Card title="Response management" desc="Review and remove individual responses. Deleting a response is permanent.">
      {subs === null ? (
        <div className="text-muted mono text-[13px] py-4">Loading responses...</div>
      ) : subs.length === 0 ? (
        <div className="text-muted-2 text-[13px] py-4 text-center">No responses collected for this study yet.</div>
      ) : (
        <>
          <div className="mono text-[11px] text-muted-2 mb-2">{subs.length} response{subs.length === 1 ? "" : "s"}</div>
          <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto">
            {subs.map((s) => (
              <div key={s.client_id} className="flex items-center justify-between gap-3 bg-surface border border-line rounded-[9px] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink truncate">{nameOf(s.geo_unit_id)}</div>
                  <div className="mono text-[10.5px] text-muted-2">{fmt(s.captured_at)}{s.status ? ` \u00b7 ${s.status}` : ""}</div>
                </div>
                <DeleteResponseButton busy={busy === s.client_id} onDelete={() => del(s.client_id)} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function DeleteResponseButton({ busy, onDelete }: { busy: boolean; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (busy) return <span className="mono text-[11px] text-muted-2">Deleting...</span>;
  if (confirm) return (
    <span className="flex items-center gap-1.5">
      <button onClick={onDelete} className="mono text-[10px] uppercase px-2 h-7 rounded bg-signal text-white">Confirm</button>
      <button onClick={() => setConfirm(false)} className="mono text-[10px] uppercase px-2 h-7 rounded border border-line text-muted">No</button>
    </span>
  );
  return <button onClick={() => setConfirm(true)} className="mono text-[10px] uppercase px-2.5 h-7 rounded border border-line text-signal hover:border-signal flex-shrink-0">Delete</button>;
}

function DangerZone({ study, userId, onDeleted }: any) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function del() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/study/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requesterId: userId, studyId: study.id }) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Could not delete study.");
      else onDeleted();
    } catch (e: any) { setMsg("Network error: " + (e?.message || "")); setBusy(false); }
  }
  return (
    <Card title="Danger zone" desc="Permanently delete this study and all of its responses. This cannot be undone." danger>
      <p className="text-[13px] text-ink mb-2">To confirm, type the study name: <b className="mono">{study.name}</b></p>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={study.name} className="w-full text-[14px] border border-line rounded-[9px] px-3 py-2.5 mb-3" />
      {msg && <div className="text-signal text-[13px] mb-2">{msg}</div>}
      <button onClick={del} disabled={busy || typed !== study.name} className="btn h-10 px-4 text-[13.5px] bg-signal text-white hover:opacity-90 disabled:opacity-40">
        {busy ? "Deleting..." : "Delete this study permanently"}
      </button>
    </Card>
  );
}

function fmt(d: string): string { try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return d?.slice(0, 16) || ""; } }
