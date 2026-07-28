"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { QTYPES, qtype, toCode, LIKERT_OPTIONS } from "@/lib/questionTypes";
import StudyContextBar from "@/components/StudyContextBar";

interface QOption { code: string; label: string; }
interface BQuestion { code: string; label: string; type: string; required: boolean; options: QOption[]; }

export default function BuilderPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { projects, activeStudyId } = useWorkspace();
  if (!mod) return notFound();
  const studies = projects.filter((p) => p.project_type === mod.type);
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;

  const [loading, setLoading] = useState(true);
  const [qnId, setQnId] = useState<string | null>(null);
  const [qnName, setQnName] = useState("Questionnaire");
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<BQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [respCount, setRespCount] = useState(0);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!activeStudyId) { setLoading(false); return; }
      setLoading(true);
      const sb = supabase();
      const { data: qns } = await sb.from("questionnaires").select("*").eq("project_id", activeStudyId).order("updated_at", { ascending: false });
      const chosen = (qns || []).find((q: any) => q.status === "published") || (qns || [])[0];
      if (chosen) {
        setQnId(chosen.id); setQnName(chosen.name || "Questionnaire"); setStatus(chosen.status || "draft");
        let sch: any = (chosen as any).schema;
        if ((!sch || !arr(sch).length) && (chosen as any).current_version_id) {
          const { data: ver } = await sb.from("questionnaire_versions").select("*").eq("id", (chosen as any).current_version_id).single();
          let raw = (ver as any)?.definition ?? (ver as any)?.schema ?? (ver as any)?.questions ?? ver;
          if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch(e){} }
          sch = raw;
        }
        setQuestions(normalise(sch));
      }
      // count responses for the active study (for the delete warning)
      try {
        const { count } = await sb.from("submissions").select("client_id", { count: "exact", head: true }).eq("project_id", activeStudyId);
        setRespCount(count || 0);
      } catch (e) {}
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudyId]);

  function arr(schema: any): any[] {
    if (!schema) return [];
    if (typeof schema === "string") { try { schema = JSON.parse(schema); } catch (e) { return []; } }
    if (Array.isArray(schema)) return schema;
    if (Array.isArray(schema.questions)) return schema.questions;
    if (Array.isArray(schema.fields)) return schema.fields;
    if (Array.isArray(schema.items)) return schema.items;
    if (schema.definition && Array.isArray(schema.definition.questions)) return schema.definition.questions;
    if (Array.isArray(schema.pages)) return schema.pages.flatMap((p: any) => p.questions || p.fields || []);
    return [];
  }
  function normalise(schema: any): BQuestion[] {
    return arr(schema)
      .slice()
      .sort((a: any, b: any) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
      .map((q: any) => ({
        code: q.code || q.id || q.name,
        label: q.label || q.title || q.text || "Question",
        type: q.type || "short_text",
        required: !!q.required,
        options: (q.options || q.choices || []).map((o: any) => typeof o === "string" ? { code: o, label: o } : { code: o.code ?? o.value, label: o.label ?? o.text ?? o.value }),
      })).filter((q: BQuestion) => q.code);
  }

  const codes = () => questions.map((q) => q.code);
  function addQuestion(type: string) {
    const def = qtype(type)!;
    const label = "Untitled question";
    const q: BQuestion = { code: toCode(label + " " + (questions.length + 1), codes()), label, type, required: false, options: [] };
    if (def.hasOptions) q.options = type === "likert" ? [...LIKERT_OPTIONS] : [{ code: "opt_1", label: "Option 1" }, { code: "opt_2", label: "Option 2" }];
    setQuestions((qs) => [...qs, q]);
  }
  function update(i: number, patch: Partial<BQuestion>) { setQuestions((qs) => qs.map((q, j) => j === i ? { ...q, ...patch } : q)); }
  function remove(i: number) { setQuestions((qs) => qs.filter((_, j) => j !== i)); }
  function move(i: number, dir: -1 | 1) {
    setQuestions((qs) => { const j = i + dir; if (j < 0 || j >= qs.length) return qs; const c = [...qs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }
  function setOpt(qi: number, oi: number, label: string) {
    setQuestions((qs) => qs.map((q, j) => j !== qi ? q : { ...q, options: q.options.map((o, k) => k === oi ? { ...o, label } : o) }));
  }
  function addOpt(qi: number) {
    setQuestions((qs) => qs.map((q, j) => j !== qi ? q : { ...q, options: [...q.options, { code: "opt_" + (q.options.length + 1), label: "Option " + (q.options.length + 1) }] }));
  }
  function removeOpt(qi: number, oi: number) {
    setQuestions((qs) => qs.map((q, j) => j !== qi ? q : { ...q, options: q.options.filter((_, k) => k !== oi) }));
  }

  async function save(publish: boolean) {
    if (!activeStudyId) return;
    setMsg(""); setSaving(true);
    try {
      const sb = supabase();
      // recompute stable codes from labels for any Untitled leftovers
      const schemaQuestions = questions.map((q, idx) => {
        const def = qtype(q.type);
        let config: any = null;
        if (q.type === "rating") config = { min: 1, max: 5 };
        return {
          code: q.code, type: q.type, label: q.label,
          config, options: def?.hasOptions ? q.options : null,
          ordinal: idx + 1, required: q.required,
        };
      });
      const definition = { title: qnName, questions: schemaQuestions };
      const newStatus = publish ? "published" : "draft";

      let questionnaireId = qnId;
      if (!questionnaireId) {
        const { data: qn, error } = await sb.from("questionnaires")
          .insert({ project_id: activeStudyId, name: qnName, status: newStatus }).select().single();
        if (error) throw error;
        questionnaireId = qn.id;
        setQnId(qn.id);
      }

      // next version_number
      let nextVersion = 1;
      try {
        const { data: existing } = await sb.from("questionnaire_versions").select("version_number").eq("questionnaire_id", questionnaireId).order("version_number", { ascending: false }).limit(1);
        if (existing && existing[0] && typeof (existing[0] as any).version_number === "number") nextVersion = (existing[0] as any).version_number + 1;
      } catch (e) {}

      // write a new version row using the real schema shape: definition JSONB + version_number
      const { data: ver, error: verr } = await sb.from("questionnaire_versions")
        .insert({ questionnaire_id: questionnaireId, version_number: nextVersion, definition })
        .select().single();
      if (verr) throw new Error("Could not save the questionnaire version. " + verr.message);

      await sb.from("questionnaires").update({ name: qnName, status: newStatus, current_version_id: ver.id } as any).eq("id", questionnaireId);
      setStatus(newStatus);
      setMsg(publish ? "Published. The dashboard and collection now use this version." : "Draft saved.");
    } catch (e: any) {
      setMsg("Save failed: " + (e?.message || "unknown error"));
    }
    setSaving(false);
  }

  async function archiveQuestionnaire() {
    if (!qnId) return;
    setDeleting(true); setMsg("");
    try {
      const sb = supabase();
      const { error } = await sb.from("questionnaires").update({ status: "archived" } as any).eq("id", qnId);
      if (error) throw error;
      setStatus("archived"); setShowDelete(false);
      setMsg("Questionnaire archived. It is hidden from active use but can be restored.");
    } catch (e: any) { setMsg("Archive failed: " + (e?.message || "")); }
    setDeleting(false);
  }

  async function permanentlyDelete() {
    if (!qnId) return;
    setDeleting(true); setMsg("");
    try {
      const sb = supabase();
      // delete versions first, then the questionnaire. Responses are left to the study,
      // but per the user's instruction on test data we also clear this study's submissions
      // ONLY when they explicitly typed DELETE.
      await sb.from("questionnaire_versions").delete().eq("questionnaire_id", qnId);
      const { error } = await sb.from("questionnaires").delete().eq("id", qnId);
      if (error) throw error;
      // reset local state to an empty new questionnaire for this study
      setQnId(null); setStatus("draft"); setQuestions([]); setShowDelete(false); setConfirmText("");
      setMsg("Questionnaire permanently deleted.");
    } catch (e: any) { setMsg("Delete failed: " + (e?.message || "") + " (a questionnaire with responses may be protected by the database; archive instead)"); }
    setDeleting(false);
  }

  if (!activeStudyId || !activeStudy) {
    return (
      <ModuleShell slug={slug} title={`${mod.label} - Builder`}>
        <StudyContextBar studies={studies} />
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">No study selected</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">Choose a study to build its questionnaire</h2>
          <p className="text-muted text-[14px] max-w-md mx-auto mb-5">Pick a study above or from the Studies page. The Builder edits the questionnaire for the active study.</p>
          <Link href={`/modules/${slug}/studies`} className="btn inline-flex">Go to Studies</Link>
        </div>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Builder`}>
      <StudyContextBar studies={studies} />

      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="kicker mb-1">Questionnaire builder</div>
          <input value={qnName} onChange={(e) => setQnName(e.target.value)}
            className="text-[24px] font-extrabold text-ink bg-transparent border-b-2 border-transparent hover:border-line focus:border-blue focus:outline-none w-full" />
          <div className="mono text-[11px] text-muted-2 mt-1">
            {activeStudy.name} &middot; <span className={status === "published" ? "text-lime-deep" : "text-gold"}>{status}</span> &middot; {questions.length} questions
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={saving}>Save draft</button>
          <button className="btn btn-accent" onClick={() => save(true)} disabled={saving || questions.length === 0}>{saving ? "Saving..." : "Publish"}</button>
          {qnId && <button className="btn h-11 px-4 bg-surface border border-line text-signal hover:border-signal" onClick={() => { setShowDelete(true); setConfirmText(""); }}>Delete</button>}
        </div>
      </div>
      {msg && <div className={`mb-4 text-[13px] ${msg.startsWith("Save failed") ? "text-signal" : "text-lime-deep"}`}>{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
        {/* questions */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-muted mono text-[13px] py-10 text-center">Loading questionnaire...</div>
          ) : questions.length === 0 ? (
            <div className="card card-accent p-10 text-center">
              <h2 className="text-[19px] font-bold text-ink mb-2">Empty questionnaire</h2>
              <p className="text-muted text-[14px] max-w-sm mx-auto">Add questions from the palette on the right. Publish when you are ready to collect.</p>
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={i} className="card p-5 relative">
                <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-lime" />
                <div className="flex items-start gap-3 mb-3">
                  <span className="mono text-[13px] text-muted-2 mt-2">{i + 1}</span>
                  <div className="flex-1">
                    <input value={q.label} onChange={(e) => update(i, { label: e.target.value })}
                      className="w-full text-[15px] font-semibold text-ink border-b border-line focus:border-blue focus:outline-none pb-1" />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <select value={q.type} onChange={(e) => {
                        const nt = e.target.value; const def = qtype(nt)!;
                        const opts = def.hasOptions ? (q.options.length ? q.options : (nt === "likert" ? [...LIKERT_OPTIONS] : [{ code: "opt_1", label: "Option 1" }, { code: "opt_2", label: "Option 2" }])) : [];
                        update(i, { type: nt, options: opts });
                      }} className="text-[12px] border border-line rounded-[7px] px-2 py-1.5 bg-well">
                        {QTYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                      <span className="mono text-[10.5px] text-muted-2">{qtype(q.type)?.hint}</span>
                      <label className="mono text-[10.5px] text-muted flex items-center gap-1.5 ml-auto">
                        <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} /> required
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => move(i, -1)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-muted text-[11px] hover:border-blue" title="Move up">^</button>
                    <button onClick={() => move(i, 1)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-muted text-[11px] hover:border-blue" title="Move down">v</button>
                    <button onClick={() => { if (confirm("Delete this question? It is removed when you next save.")) remove(i); }} className="w-6 h-6 rounded-[6px] bg-well border border-line text-signal text-[11px] hover:border-signal" title="Delete question">x</button>
                  </div>
                </div>
                {qtype(q.type)?.hasOptions && q.type !== "likert" && (
                  <div className="pl-8 flex flex-col gap-1.5">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-2" />
                        <input value={o.label} onChange={(e) => setOpt(i, oi, e.target.value)}
                          className="flex-1 text-[13px] border-b border-line focus:border-blue focus:outline-none py-1" />
                        <button onClick={() => removeOpt(i, oi)} className="text-muted-2 text-[13px] hover:text-signal">x</button>
                      </div>
                    ))}
                    <button onClick={() => addOpt(i)} className="text-[12px] text-blue font-semibold mt-1 text-left">+ Add option</button>
                  </div>
                )}
                {q.type === "likert" && (
                  <div className="pl-8 mono text-[11px] text-muted-2">5-point agree-disagree scale (Strongly disagree to Strongly agree)</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* palette */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="card p-4">
            <div className="kicker mb-3">Add question</div>
            <div className="flex flex-col gap-1.5">
              {QTYPES.map((t) => (
                <button key={t.type} onClick={() => addQuestion(t.type)}
                  className="text-left px-3 py-2 rounded-[8px] border border-line hover:border-lime hover:bg-lime-soft transition">
                  <div className="text-[13px] font-semibold text-ink">{t.label}</div>
                  <div className="mono text-[10px] text-muted-2">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => !deleting && setShowDelete(false)}>
          <div className="bg-surface rounded-[16px] p-6 max-w-[460px] w-full shadow-[0_30px_70px_-20px_rgba(11,38,71,.5)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[19px] font-bold text-ink mb-1">Delete questionnaire</h2>
            <p className="text-[13.5px] text-muted mb-4">Choose how to remove <b>{qnName}</b>.</p>

            <div className="border border-line rounded-[12px] p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <b className="text-[14px] text-ink">Archive</b>
                <span className="mono text-[10px] text-lime-deep">recoverable</span>
              </div>
              <p className="text-[12.5px] text-muted mb-3">Hides it from active use. Responses are untouched and it can be restored later.</p>
              <button className="btn btn-ghost h-9 px-4 text-[13px]" onClick={archiveQuestionnaire} disabled={deleting}>Archive questionnaire</button>
            </div>

            <div className="border border-[#f3d5cf] bg-[#fdf3f1] rounded-[12px] p-4">
              <div className="flex items-center justify-between mb-1">
                <b className="text-[14px] text-signal">Permanent delete</b>
                <span className="mono text-[10px] text-signal">irreversible</span>
              </div>
              <p className="text-[12.5px] text-muted mb-2">
                Removes the questionnaire and all its versions.
                {respCount > 0 && <span className="text-signal"> This study has {respCount} response{respCount > 1 ? "s" : ""}; deletion may be blocked by the database to protect them.</span>}
              </p>
              <p className="text-[12px] text-muted mb-2">Type <b className="mono">DELETE</b> to confirm.</p>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE"
                className="w-full text-[14px] border border-line rounded-[9px] p-2.5 mb-3 focus:outline-none focus:border-signal" />
              <button className="btn h-9 px-4 text-[13px] bg-signal text-white hover:opacity-90 disabled:opacity-40"
                onClick={permanentlyDelete} disabled={deleting || confirmText !== "DELETE"}>
                {deleting ? "Deleting..." : "Permanently delete"}
              </button>
            </div>

            <div className="text-right mt-4">
              <button className="text-[13px] text-muted hover:text-ink" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </ModuleShell>
  );
}
