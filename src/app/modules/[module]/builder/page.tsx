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
        try { if (typeof window !== "undefined") console.log("[Builder] chosen.schema:", typeof sch, JSON.stringify(sch)?.slice(0,300), "current_version_id:", (chosen as any).current_version_id); } catch(e){}
        if ((!sch || !arr(sch).length) && (chosen as any).current_version_id) {
          const { data: ver, error: ve } = await sb.from("questionnaire_versions").select("*").eq("id", (chosen as any).current_version_id).single();
          try { if (typeof window !== "undefined") { console.log("[Builder] version error:", ve?.message); console.log("[Builder] version row:", JSON.stringify(ver)?.slice(0,600)); } } catch(e){}
          let raw = (ver as any)?.schema ?? (ver as any)?.questions ?? ver;
          if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch(e){} }
          sch = raw;
        }
        try { if (typeof window !== "undefined") console.log("[Builder] normalised count:", normalise(sch).length); } catch(e){}
        setQuestions(normalise(sch));
      }
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
    if (Array.isArray(schema.pages)) return schema.pages.flatMap((p: any) => p.questions || p.fields || []);
    return [];
  }
  function normalise(schema: any): BQuestion[] {
    return arr(schema).map((q: any) => ({
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
      const schemaQuestions = questions.map((q) => ({
        code: q.code, label: q.label, type: q.type, required: q.required,
        options: qtype(q.type)?.hasOptions ? q.options : undefined,
      }));
      const schema = { questions: schemaQuestions };
      const newStatus = publish ? "published" : "draft";

      let questionnaireId = qnId;
      if (!questionnaireId) {
        const { data: qn, error } = await sb.from("questionnaires")
          .insert({ project_id: activeStudyId, name: qnName, status: newStatus }).select().single();
        if (error) throw error;
        questionnaireId = qn.id;
        setQnId(qn.id);
      }

      // determine next version number (best effort)
      let nextVersion = 1;
      try {
        const { data: existing } = await sb.from("questionnaire_versions").select("version").eq("questionnaire_id", questionnaireId).order("version", { ascending: false }).limit(1);
        if (existing && existing[0] && typeof (existing[0] as any).version === "number") nextVersion = (existing[0] as any).version + 1;
      } catch (e) {}

      // write a new version row holding the schema (try common column shapes)
      let versionId: string | null = null;
      const attempts: any[] = [
        { questionnaire_id: questionnaireId, schema, version: nextVersion },
        { questionnaire_id: questionnaireId, schema },
        { questionnaire_id: questionnaireId, questions: schema.questions, version: nextVersion },
      ];
      let lastErr: any = null;
      for (const payload of attempts) {
        const { data: ver, error: verr } = await sb.from("questionnaire_versions").insert(payload).select().single();
        if (!verr && ver) { versionId = ver.id; break; }
        lastErr = verr;
      }

      if (versionId) {
        await sb.from("questionnaires").update({ name: qnName, status: newStatus, current_version_id: versionId } as any).eq("id", questionnaireId);
      } else {
        // last resort: store schema directly on the questionnaire row
        const { error: upErr } = await sb.from("questionnaires").update({ name: qnName, status: newStatus, schema } as any).eq("id", questionnaireId);
        if (upErr) throw new Error("Could not save the questionnaire version. " + (lastErr?.message || upErr.message || ""));
      }
      setStatus(newStatus);
      setMsg(publish ? "Published. The dashboard and collection now use this version." : "Draft saved.");
    } catch (e: any) {
      setMsg("Save failed: " + (e?.message || "unknown error"));
    }
    setSaving(false);
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
                    <button onClick={() => remove(i)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-signal text-[11px] hover:border-signal" title="Delete">x</button>
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
    </ModuleShell>
  );
}
