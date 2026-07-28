"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { QTYPES, qtype, toCode, GROUP_LABELS, GROUP_ORDER, defaultOptions, defaultColumns } from "@/lib/questionTypes";
import { QUESTION_LIBRARY, TEMPLATES, LibQuestion } from "@/lib/questionLibrary";
import { useGeoRef, DEFAULT_PARTIES } from "@/lib/geoRef";
import { BDefinition, BSection, BQuestion, BOption, uid } from "@/lib/builderTypes";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import Preview from "@/components/builder/Preview";
import StudyContextBar from "@/components/StudyContextBar";

const emptyDef = (title: string): BDefinition => ({
  title,
  pageTitles: ["Page 1"],
  sections: [{ id: uid("s"), title: "Section 1", description: "", page: 0, questions: [] }],
});

export default function BuilderPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { projects, activeStudyId } = useWorkspace();
  const geo = useGeoRef();

  const [loading, setLoading] = useState(true);
  const [qnId, setQnId] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [def, setDef] = useState<BDefinition>(emptyDef("Questionnaire"));
  const [selected, setSelected] = useState<string | null>(null);   // question id
  const [showPreview, setShowPreview] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [respCount, setRespCount] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // undo / redo
  const undoStack = useRef<BDefinition[]>([]);
  const redoStack = useRef<BDefinition[]>([]);
  const skipHistory = useRef(false);

  const studies = mod ? projects.filter((p) => p.project_type === mod.type) : [];
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;

  // push history on def change
  const commit = useCallback((next: BDefinition | ((d: BDefinition) => BDefinition)) => {
    setDef((cur) => {
      const resolved = typeof next === "function" ? (next as any)(cur) : next;
      if (!skipHistory.current) { undoStack.current.push(cur); redoStack.current = []; if (undoStack.current.length > 100) undoStack.current.shift(); }
      skipHistory.current = false;
      return resolved;
    });
  }, []);

  function undo() { if (!undoStack.current.length) return; redoStack.current.push(def); const prev = undoStack.current.pop()!; skipHistory.current = true; setDef(prev); }
  function redo() { if (!redoStack.current.length) return; undoStack.current.push(def); const nxt = redoStack.current.pop()!; skipHistory.current = true; setDef(nxt); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  // ---- load existing questionnaire ----
  useEffect(() => {
    (async () => {
      if (!activeStudyId) { setLoading(false); return; }
      setLoading(true);
      const sb = supabase();
      const { data: qns } = await sb.from("questionnaires").select("*").eq("project_id", activeStudyId).order("updated_at", { ascending: false });
      const chosen = (qns || []).find((q: any) => q.status === "published") || (qns || [])[0];
      if (chosen) {
        setQnId(chosen.id); setStatus(chosen.status || "draft");
        let definition: any = null;
        if ((chosen as any).current_version_id) {
          const { data: ver } = await sb.from("questionnaire_versions").select("*").eq("id", (chosen as any).current_version_id).single();
          definition = (ver as any)?.definition || (ver as any)?.schema || null;
        }
        setDef(fromStored(chosen.name || "Questionnaire", definition));
      } else {
        setDef(emptyDef(activeStudy?.name ? activeStudy.name + " questionnaire" : "Questionnaire"));
      }
      try {
        const { count } = await sb.from("submissions").select("client_id", { count: "exact", head: true }).eq("project_id", activeStudyId);
        setRespCount(count || 0);
      } catch (e) {}
      undoStack.current = []; redoStack.current = [];
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudyId]);

  // convert stored definition (flat questions OR sectioned) into our BDefinition
  function fromStored(title: string, d: any): BDefinition {
    if (!d) return emptyDef(title);
    if (typeof d === "string") { try { d = JSON.parse(d); } catch { return emptyDef(title); } }
    // already sectioned?
    if (Array.isArray(d.sections)) {
      return {
        title: d.title || title,
        pageTitles: d.pageTitles && d.pageTitles.length ? d.pageTitles : ["Page 1"],
        sections: d.sections.map((s: any) => ({
          id: uid("s"), title: s.title || "Section", description: s.description || "", page: s.page || 0,
          questions: (s.questions || []).map(mapQ),
        })),
      };
    }
    // flat questions array -> single section
    const flat = Array.isArray(d.questions) ? d.questions : Array.isArray(d) ? d : [];
    return {
      title: d.title || title, pageTitles: ["Page 1"],
      sections: [{ id: uid("s"), title: "Section 1", description: "", page: 0, questions: flat.slice().sort((a: any, b: any) => (a.ordinal ?? 0) - (b.ordinal ?? 0)).map(mapQ) }],
    };
  }
  function mapQ(q: any): BQuestion {
    return {
      id: uid("q"), code: q.code || q.id || q.name, label: q.label || q.title || q.text || "Question",
      type: q.type || "short_text", required: !!q.required, description: q.description || "", help: q.help || "",
      options: (q.options || q.choices || []).map((o: any) => typeof o === "string" ? { code: o, label: o } : { code: o.code ?? o.value, label: o.label ?? o.text ?? o.value }),
      columns: (q.columns || []).map((o: any) => ({ code: o.code, label: o.label })),
      config: q.config || {}, validation: q.validation || {}, defaultValue: q.defaultValue || "",
      scoring: q.scoring || {}, randomise: !!q.randomise, visibility: q.visibility || "always", skip: q.skip || null,
    };
  }

  // ---- helpers to find/modify questions ----
  const allQuestions = () => def.sections.flatMap((s) => s.questions);
  const existingCodes = () => allQuestions().map((q) => q.code);
  const selectedQ = (): { q: BQuestion; si: number; qi: number } | null => {
    for (let si = 0; si < def.sections.length; si++) {
      const qi = def.sections[si].questions.findIndex((q) => q.id === selected);
      if (qi >= 0) return { q: def.sections[si].questions[qi], si, qi };
    }
    return null;
  };

  function optionsForType(type: string): { options: BOption[]; columns: BOption[] } {
    const d = qtype(type)!;
    let options = defaultOptions(d);
    const columns = defaultColumns(d);
    if (d.optionSource === "party") options = DEFAULT_PARTIES.map((o) => ({ ...o }));
    if (d.optionSource === "region") options = geo.regions.length ? geo.regions.slice() : [{ code: "r1", label: "Region 1" }];
    if (d.optionSource === "district") options = geo.districts.length ? geo.districts.slice(0, 50) : [{ code: "d1", label: "District 1" }];
    if (d.optionSource === "constituency") options = geo.constituencies.length ? geo.constituencies.slice(0, 50) : [{ code: "c1", label: "Constituency 1" }];
    if (d.optionSource === "candidate") options = [{ code: "cand_1", label: "Candidate 1" }, { code: "cand_2", label: "Candidate 2" }];
    if (d.optionSource === "polling_station") options = [{ code: "ps_1", label: "Polling station 1" }];
    return { options, columns };
  }

  function addQuestion(sectionId: string, type: string) {
    const d = qtype(type)!;
    const { options, columns } = optionsForType(type);
    const label = "Untitled question";
    const nq: BQuestion = {
      id: uid("q"), code: toCode(label + " " + (allQuestions().length + 1), existingCodes()),
      label, type, required: false, options: d.hasOptions ? options : [], columns,
      config: d.scale ? { min: 1, max: 5, step: 1 } : {}, validation: {}, visibility: "always", skip: null,
    };
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => s.id === sectionId ? { ...s, questions: [...s.questions, nq] } : s) }));
    setSelected(nq.id);
  }

  function insertLibrary(item: LibQuestion, sectionId?: string) {
    const sid = sectionId || def.sections[0]?.id;
    if (!sid) return;
    const d = qtype(item.type)!;
    let opts = item.options ? item.options.slice() : optionsForType(item.type).options;
    const nq: BQuestion = {
      id: uid("q"), code: toCode(item.label, existingCodes()), label: item.label, type: item.type,
      required: false, options: d.hasOptions ? opts : [], columns: defaultColumns(d),
      config: item.config || (d.scale ? { min: 1, max: 5 } : {}), validation: {}, visibility: "always", skip: null,
    };
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => s.id === sid ? { ...s, questions: [...s.questions, nq] } : s) }));
    setShowLibrary(false); setSelected(nq.id);
  }

  function loadTemplate(tk: string) {
    const tpl = TEMPLATES.find((t) => t.key === tk); if (!tpl) return;
    const qs: BQuestion[] = tpl.questions.map((item) => {
      const d = qtype(item.type)!;
      let opts = item.options ? item.options.slice() : optionsForType(item.type).options;
      return {
        id: uid("q"), code: toCode(item.label, []), label: item.label, type: item.type, required: false,
        options: d.hasOptions ? opts : [], columns: defaultColumns(d),
        config: item.config || (d.scale ? { min: 1, max: 5 } : {}), validation: {}, visibility: "always", skip: null,
      };
    });
    // dedupe codes
    const seen: string[] = [];
    qs.forEach((q) => { let c = q.code, n = 1; while (seen.includes(c)) c = q.code + "_" + (++n); q.code = c; seen.push(c); });
    commit({ title: tpl.name, pageTitles: ["Page 1"], sections: [{ id: uid("s"), title: tpl.name, description: tpl.blurb, page: 0, questions: qs }] });
    setShowTemplates(false);
  }

  function updateQuestion(id: string, patch: Partial<BQuestion>) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => {
      if (q.id !== id) return q;
      const nq = { ...q, ...patch };
      // if type changed, refresh options/columns/config appropriately
      if (patch.type && patch.type !== q.type) {
        const d = qtype(patch.type)!;
        const { options, columns } = optionsForType(patch.type);
        nq.options = d.hasOptions ? (q.options.length && qtype(q.type)?.hasOptions ? q.options : options) : [];
        nq.columns = columns;
        if (d.scale && !nq.config?.max) nq.config = { min: 1, max: 5, step: 1 };
      }
      return nq;
    }) })) }));
  }
  function duplicateQuestion(id: string) {
    commit((cur) => {
      const secs = cur.sections.map((s) => {
        const qi = s.questions.findIndex((q) => q.id === id);
        if (qi < 0) return s;
        const orig = s.questions[qi];
        const copy: BQuestion = { ...orig, id: uid("q"), code: toCode(orig.label + " copy", cur.sections.flatMap((x) => x.questions).map((q) => q.code)), options: orig.options.map((o) => ({ ...o })), columns: orig.columns?.map((o) => ({ ...o })) };
        const nq = [...s.questions]; nq.splice(qi + 1, 0, copy);
        return { ...s, questions: nq };
      });
      return { ...cur, sections: secs };
    });
  }
  function deleteQuestion(id: string) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) })) }));
    if (selected === id) setSelected(null);
  }
  function moveQuestion(sectionId: string, from: number, to: number) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => {
      if (s.id !== sectionId) return s;
      if (to < 0 || to >= s.questions.length) return s;
      const q = [...s.questions]; const [m] = q.splice(from, 1); q.splice(to, 0, m); return { ...s, questions: q };
    }) }));
  }
  // move a question to another section (drag across)
  function moveQuestionToSection(qId: string, targetSectionId: string, targetIndex: number) {
    commit((cur) => {
      let moved: BQuestion | null = null;
      const stripped = cur.sections.map((s) => {
        const qi = s.questions.findIndex((q) => q.id === qId);
        if (qi < 0) return s;
        moved = s.questions[qi];
        return { ...s, questions: s.questions.filter((q) => q.id !== qId) };
      });
      if (!moved) return cur;
      return { ...cur, sections: stripped.map((s) => {
        if (s.id !== targetSectionId) return s;
        const q = [...s.questions]; const idx = Math.min(Math.max(targetIndex, 0), q.length); q.splice(idx, 0, moved!); return { ...s, questions: q };
      }) };
    });
  }

  function addSection(page = 0) {
    const n = def.sections.length + 1;
    commit((cur) => ({ ...cur, sections: [...cur.sections, { id: uid("s"), title: "Section " + n, description: "", page, questions: [] }] }));
  }
  function updateSection(id: string, patch: Partial<BSection>) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  }
  function deleteSection(id: string) {
    if (def.sections.length <= 1) { setMsg("Keep at least one section."); return; }
    commit((cur) => ({ ...cur, sections: cur.sections.filter((s) => s.id !== id) }));
  }
  function addPage() {
    commit((cur) => ({ ...cur, pageTitles: [...cur.pageTitles, "Page " + (cur.pageTitles.length + 1)] }));
  }
  function updatePageTitle(i: number, title: string) {
    commit((cur) => ({ ...cur, pageTitles: cur.pageTitles.map((p, j) => j === i ? title : p) }));
  }

  // ---- option editing within a question card ----
  function setOption(qId: string, oi: number, label: string) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => q.id !== qId ? q : { ...q, options: q.options.map((o, k) => k === oi ? { ...o, label } : o) }) })) }));
  }
  function addOption(qId: string) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => q.id !== qId ? q : { ...q, options: [...q.options, { code: "opt_" + (q.options.length + 1), label: "Option " + (q.options.length + 1) }] }) })) }));
  }
  function removeOption(qId: string, oi: number) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => q.id !== qId ? q : { ...q, options: q.options.filter((_, k) => k !== oi) }) })) }));
  }
  function setColumn(qId: string, ci: number, label: string) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => q.id !== qId ? q : { ...q, columns: (q.columns || []).map((o, k) => k === ci ? { ...o, label } : o) }) })) }));
  }
  function addColumn(qId: string) {
    commit((cur) => ({ ...cur, sections: cur.sections.map((s) => ({ ...s, questions: s.questions.map((q) => q.id !== qId ? q : { ...q, columns: [...(q.columns || []), { code: "col_" + ((q.columns?.length || 0) + 1), label: "Column " + ((q.columns?.length || 0) + 1) }] }) })) }));
  }

  // ---- build stored definition ----
  function toStored(): any {
    let ordinal = 0;
    return {
      title: def.title,
      pageTitles: def.pageTitles,
      // flat questions with ordinal for backward-compatible analytics
      questions: def.sections.flatMap((s) => s.questions.map((q) => {
        ordinal++;
        const d = qtype(q.type);
        return {
          code: q.code, type: q.type, label: q.label, description: q.description || null, help: q.help || null,
          config: d?.scale ? { min: q.config?.min ?? 1, max: q.config?.max ?? 5, step: q.config?.step ?? 1 } : (q.config && Object.keys(q.config).length ? q.config : null),
          options: d?.hasOptions ? q.options : null, columns: d?.grid ? (q.columns || []) : null,
          validation: q.validation || null, defaultValue: q.defaultValue || null, scoring: q.scoring || null,
          randomise: !!q.randomise, visibility: q.visibility || "always", skip: q.skip || null,
          section: s.title, page: s.page, ordinal, required: q.required,
        };
      })),
      // structured form for the builder to reload exactly
      sections: def.sections.map((s) => ({ title: s.title, description: s.description || "", page: s.page,
        questions: s.questions.map((q) => ({ code: q.code, type: q.type, label: q.label, description: q.description || null, help: q.help || null, config: q.config || null, options: q.options || null, columns: q.columns || null, validation: q.validation || null, defaultValue: q.defaultValue || null, scoring: q.scoring || null, randomise: !!q.randomise, visibility: q.visibility || "always", skip: q.skip || null, required: q.required })) })),
    };
  }

  async function save(publish: boolean) {
    if (!activeStudyId) return;
    if (allQuestions().length === 0 && publish) { setMsg("Add at least one question before publishing."); return; }
    setMsg(""); setSaving(true);
    try {
      const sb = supabase();
      const definition = toStored();
      const newStatus = publish ? "published" : "draft";
      let questionnaireId = qnId;
      if (!questionnaireId) {
        const { data: qn, error } = await sb.from("questionnaires").insert({ project_id: activeStudyId, name: def.title, status: newStatus }).select().single();
        if (error) throw error;
        questionnaireId = qn.id; setQnId(qn.id);
      }
      let nextVersion = 1;
      try {
        const { data: ex } = await sb.from("questionnaire_versions").select("version_number").eq("questionnaire_id", questionnaireId).order("version_number", { ascending: false }).limit(1);
        if (ex && ex[0] && typeof (ex[0] as any).version_number === "number") nextVersion = (ex[0] as any).version_number + 1;
      } catch (e) {}
      const { data: ver, error: verr } = await sb.from("questionnaire_versions").insert({ questionnaire_id: questionnaireId, version_number: nextVersion, definition }).select().single();
      if (verr) throw new Error("Could not save version. " + verr.message);
      await sb.from("questionnaires").update({ name: def.title, status: newStatus, current_version_id: ver.id } as any).eq("id", questionnaireId);
      setStatus(newStatus);
      setMsg(publish ? "Published. The dashboard and collection now use this version." : "Draft saved.");
    } catch (e: any) { setMsg("Save failed: " + (e?.message || "")); }
    setSaving(false);
  }

  // auto-save (debounced) when there is already a questionnaire and it's a draft
  const autoTimer = useRef<any>(null);
  useEffect(() => {
    if (loading || !qnId) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { save(false); }, 4000);
    return () => autoTimer.current && clearTimeout(autoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  async function archiveQuestionnaire() {
    if (!qnId) return; setDeleting(true); setMsg("");
    try { const { error } = await supabase().from("questionnaires").update({ status: "archived" } as any).eq("id", qnId); if (error) throw error;
      setStatus("archived"); setShowDelete(false); setMsg("Questionnaire archived."); } catch (e: any) { setMsg("Archive failed: " + (e?.message || "")); }
    setDeleting(false);
  }
  async function permanentlyDelete() {
    if (!qnId) return; setDeleting(true); setMsg("");
    try { const sb = supabase();
      await sb.from("questionnaire_versions").delete().eq("questionnaire_id", qnId);
      const { error } = await sb.from("questionnaires").delete().eq("id", qnId); if (error) throw error;
      setQnId(null); setStatus("draft"); setDef(emptyDef(activeStudy?.name ? activeStudy.name + " questionnaire" : "Questionnaire"));
      setShowDelete(false); setConfirmText(""); setMsg("Questionnaire permanently deleted.");
    } catch (e: any) { setMsg("Delete failed: " + (e?.message || "") + " (archive instead if responses protect it)"); }
    setDeleting(false);
  }

  if (!mod) return notFound();

  if (!activeStudyId || !activeStudy) {
    return (
      <ModuleShell slug={slug} title={`${mod.label} - Builder`}>
        <StudyContextBar studies={studies} />
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">No study selected</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">Choose a study to build its questionnaire</h2>
          <p className="text-muted text-[14px] max-w-md mx-auto mb-5">Pick a study above or from the Studies page.</p>
          <Link href={`/modules/${slug}/studies`} className="btn inline-flex">Go to Studies</Link>
        </div>
      </ModuleShell>
    );
  }

  const sel = selectedQ();

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Builder`}>
      <StudyContextBar studies={studies} />

      {/* toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="kicker mb-1">Questionnaire builder &middot; {activeStudy.name}</div>
          <input value={def.title} onChange={(e) => commit((c) => ({ ...c, title: e.target.value }))}
            className="text-[22px] font-extrabold text-ink bg-transparent border-b-2 border-transparent hover:border-line focus:border-blue focus:outline-none w-full" />
        </div>
        <button className="btn btn-ghost h-10 px-3 text-[13px]" onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)">Undo</button>
        <button className="btn btn-ghost h-10 px-3 text-[13px]" onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Y)">Redo</button>
        <button className="btn btn-ghost h-10 px-3 text-[13px]" onClick={() => setShowPreview(true)}>Preview</button>
        <button className="btn btn-ghost h-10 px-3 text-[13px]" onClick={() => save(false)} disabled={saving}>Save draft</button>
        <button className="btn btn-accent h-10 px-4 text-[13px]" onClick={() => save(true)} disabled={saving || allQuestions().length === 0}>{saving ? "Saving..." : "Publish"}</button>
        {qnId && <button className="btn h-10 px-3 text-[13px] bg-surface border border-line text-signal hover:border-signal" onClick={() => { setShowDelete(true); setConfirmText(""); }}>Delete</button>}
      </div>
      <div className="flex items-center gap-3 mb-4 mono text-[11px] text-muted-2">
        <span className={status === "published" ? "text-lime-deep" : status === "archived" ? "text-muted-2" : "text-gold"}>{status}</span>
        <span>{allQuestions().length} questions</span><span>{def.sections.length} sections</span><span>{def.pageTitles.length} pages</span>
        <button className="text-blue" onClick={() => setShowLibrary(true)}>+ Question library</button>
        <button className="text-blue" onClick={() => setShowTemplates(true)}>Load template</button>
      </div>
      {msg && <div className={`mb-4 text-[13px] ${msg.startsWith("Save failed") || msg.startsWith("Archive failed") || msg.startsWith("Delete failed") ? "text-signal" : "text-lime-deep"}`}>{msg}</div>}

      <div className="flex gap-0">
        {/* main canvas */}
        <div className="flex-1 min-w-0 pr-5">
          {loading ? (
            <div className="text-muted mono text-[13px] py-10 text-center">Loading questionnaire...</div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* group sections by page */}
              {def.pageTitles.map((pt, pageIdx) => {
                const pageSections = def.sections.filter((s) => (s.page || 0) === pageIdx);
                return (
                  <div key={pageIdx} className="flex flex-col gap-4">
                    {def.pageTitles.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="mono text-[10px] uppercase tracking-wide text-blue bg-blue-soft rounded-full px-2.5 py-1">Page {pageIdx + 1}</span>
                        <input value={pt} onChange={(e) => updatePageTitle(pageIdx, e.target.value)} className="text-[14px] font-semibold text-ink bg-transparent border-b border-transparent hover:border-line focus:border-blue focus:outline-none" />
                      </div>
                    )}
                    {pageSections.map((s) => (
                      <SectionCard key={s.id} section={s} allQuestions={allQuestions()}
                        selected={selected} onSelect={setSelected}
                        onSection={(patch: Partial<BSection>) => updateSection(s.id, patch)} onDeleteSection={() => deleteSection(s.id)}
                        onAdd={(type: string) => addQuestion(s.id, type)} onMove={(from: number, to: number) => moveQuestion(s.id, from, to)}
                        onMoveAcross={moveQuestionToSection}
                        onDuplicate={duplicateQuestion} onDelete={deleteQuestion} onUpdate={updateQuestion}
                        onSetOption={setOption} onAddOption={addOption} onRemoveOption={removeOption}
                        onSetColumn={setColumn} onAddColumn={addColumn}
                        pages={def.pageTitles.length} />
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => addSection(pageIdx)} className="btn btn-ghost h-10 px-4 text-[13px]">+ Add section</button>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button onClick={addPage} className="btn btn-ghost h-10 px-4 text-[13px]">+ Add page</button>
              </div>
            </div>
          )}
        </div>

        {/* right rail: palette OR properties */}
        {sel ? (
          <PropertiesPanel q={sel.q} onChange={(patch) => updateQuestion(sel.q.id, patch)} onClose={() => setSelected(null)} />
        ) : (
          <Palette onAdd={(type) => { const sid = def.sections[def.sections.length - 1]?.id; if (sid) addQuestion(sid, type); }} />
        )}
      </div>

      {showPreview && <Preview def={def} onClose={() => setShowPreview(false)} />}
      {showLibrary && <LibraryModal onInsert={(item) => insertLibrary(item)} onClose={() => setShowLibrary(false)} />}
      {showTemplates && <TemplatesModal onLoad={loadTemplate} onClose={() => setShowTemplates(false)} />}
      {showDelete && (
        <DeleteModal name={def.title} respCount={respCount} deleting={deleting} confirmText={confirmText} setConfirmText={setConfirmText}
          onArchive={archiveQuestionnaire} onPermanent={permanentlyDelete} onClose={() => setShowDelete(false)} />
      )}
    </ModuleShell>
  );
}

/* ---------------- Section card ---------------- */
function SectionCard(props: any) {
  const { section: s, selected, onSelect, onSection, onDeleteSection, onAdd, onMove, onMoveAcross,
    onDuplicate, onDelete, onUpdate, onSetOption, onAddOption, onRemoveOption, onSetColumn, onAddColumn } = props;
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4 border-b border-line-2 pb-3">
        <span className="w-1.5 self-stretch rounded bg-lime" />
        <div className="flex-1">
          <input value={s.title} onChange={(e) => onSection({ title: e.target.value })}
            className="text-[16px] font-bold text-ink bg-transparent border-b border-transparent hover:border-line focus:border-blue focus:outline-none w-full" />
          <input value={s.description || ""} onChange={(e) => onSection({ description: e.target.value })} placeholder="Section description (optional)"
            className="text-[12.5px] text-muted bg-transparent border-b border-transparent hover:border-line focus:border-blue focus:outline-none w-full mt-1" />
        </div>
        <button onClick={onDeleteSection} className="text-muted-2 hover:text-signal text-[12px] mono">remove</button>
      </div>

      <div className="flex flex-col gap-3">
        {s.questions.length === 0 && <div className="text-muted-2 text-[13px] text-center py-4">No questions yet. Add from the palette on the right.</div>}
        {s.questions.map((q: BQuestion, i: number) => (
          <div key={q.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIdx !== null && dragIdx !== i) onMove(dragIdx, i); setDragIdx(null); }}
            className={`rounded-[11px] border p-4 bg-surface transition ${selected === q.id ? "border-blue ring-1 ring-blue" : "border-line hover:border-muted-2"}`}
            onClick={() => onSelect(q.id)}>
            <div className="flex items-start gap-3">
              <span className="mono text-[12px] text-muted-2 cursor-grab mt-1" title="Drag to reorder">::</span>
              <div className="flex-1 min-w-0">
                <input value={q.label} onChange={(e) => onUpdate(q.id, { label: e.target.value })} onClick={(e) => e.stopPropagation()}
                  className="w-full text-[14.5px] font-semibold text-ink border-b border-line focus:border-blue focus:outline-none pb-1" />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="mono text-[10px] uppercase tracking-wide text-white bg-blue rounded px-1.5 py-0.5">{qtype(q.type)?.badge}</span>
                  <span className="mono text-[10.5px] text-muted-2">{qtype(q.type)?.label}</span>
                  {q.required && <span className="mono text-[9px] text-signal">required</span>}
                  {qtype(q.type)?.build === "collect" && <span className="mono text-[9px] text-blue">field capture</span>}
                  {qtype(q.type)?.build === "engine" && <span className="mono text-[9px] text-gold">logic</span>}
                </div>

                {/* inline option editor */}
                {qtype(q.type)?.hasOptions && !qtype(q.type)?.grid && (
                  <div className="mt-3 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {q.options.map((o: BOption, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-2" />
                        <input value={o.label} onChange={(e) => onSetOption(q.id, oi, e.target.value)} className="flex-1 text-[13px] border-b border-line focus:border-blue focus:outline-none py-0.5" />
                        <button onClick={() => onRemoveOption(q.id, oi)} className="text-muted-2 hover:text-signal text-[13px]">x</button>
                      </div>
                    ))}
                    <button onClick={() => onAddOption(q.id)} className="text-[12px] text-blue font-semibold mt-0.5 text-left">+ Add option</button>
                  </div>
                )}
                {/* grid rows + columns */}
                {qtype(q.type)?.grid && (
                  <div className="mt-3 grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="mono text-[9px] uppercase text-muted-2 mb-1">Rows</div>
                      {q.options.map((o: BOption, oi: number) => (
                        <div key={oi} className="flex items-center gap-1.5 mb-1"><input value={o.label} onChange={(e) => onSetOption(q.id, oi, e.target.value)} className="flex-1 text-[12px] border-b border-line focus:border-blue focus:outline-none py-0.5" /><button onClick={() => onRemoveOption(q.id, oi)} className="text-muted-2 hover:text-signal text-[12px]">x</button></div>
                      ))}
                      <button onClick={() => onAddOption(q.id)} className="text-[11px] text-blue font-semibold">+ Row</button>
                    </div>
                    <div>
                      <div className="mono text-[9px] uppercase text-muted-2 mb-1">Columns</div>
                      {(q.columns || []).map((o: BOption, ci: number) => (
                        <div key={ci} className="flex items-center gap-1.5 mb-1"><input value={o.label} onChange={(e) => onSetColumn(q.id, ci, e.target.value)} className="flex-1 text-[12px] border-b border-line focus:border-blue focus:outline-none py-0.5" /></div>
                      ))}
                      <button onClick={() => onAddColumn(q.id)} className="text-[11px] text-blue font-semibold">+ Column</button>
                    </div>
                  </div>
                )}
                {qtype(q.type)?.scale && (
                  <div className="mt-2 mono text-[11px] text-muted-2" onClick={(e) => e.stopPropagation()}>Scale {q.config?.min ?? 1} to {q.config?.max ?? 5}{q.type === "slider" ? `, step ${q.config?.step ?? 1}` : ""}</div>
                )}
              </div>
              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onMove(i, i - 1)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-muted text-[11px] hover:border-blue" title="Up">^</button>
                <button onClick={() => onMove(i, i + 1)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-muted text-[11px] hover:border-blue" title="Down">v</button>
                <button onClick={() => onDuplicate(q.id)} className="w-6 h-6 rounded-[6px] bg-well border border-line text-blue text-[11px] hover:border-blue" title="Duplicate">D</button>
                <button onClick={() => { if (confirm("Delete this question?")) onDelete(q.id); }} className="w-6 h-6 rounded-[6px] bg-well border border-line text-signal text-[11px] hover:border-signal" title="Delete">x</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onAdd("short_text")} className="text-[13px] text-blue font-semibold mt-3">+ Add question</button>
    </div>
  );
}

/* ---------------- Palette ---------------- */
function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [group, setGroup] = useState<string>("basic");
  return (
    <div className="w-[260px] flex-shrink-0 border-l border-line bg-surface min-h-full">
      <div className="px-4 py-3 border-b border-line sticky top-14 bg-surface z-10"><span className="kicker">Add question</span></div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1 mb-3">
          {GROUP_ORDER.map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={`mono text-[9.5px] uppercase px-2 h-6 rounded-full border ${group === g ? "bg-blue text-white border-blue" : "bg-well border-line text-muted"}`}>{GROUP_LABELS[g].split(" ")[0]}</button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {QTYPES.filter((t) => t.group === group).map((t) => (
            <button key={t.type} onClick={() => onAdd(t.type)} className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-[8px] border border-line hover:border-lime hover:bg-lime-soft transition">
              <span className="w-8 h-7 flex-shrink-0 grid place-items-center rounded-[6px] bg-ink text-white mono text-[10px] font-bold">{t.badge}</span>
              <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-ink truncate">{t.label}</span><span className="block mono text-[9.5px] text-muted-2 truncate">{t.hint}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Library modal ---------------- */
function LibraryModal({ onInsert, onClose }: { onInsert: (q: LibQuestion) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/45 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-[16px] max-w-[520px] w-full p-6 shadow-[0_30px_70px_-20px_rgba(11,38,71,.5)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h2 className="text-[19px] font-bold text-ink">Question library</h2><button onClick={onClose} className="text-muted-2 hover:text-ink">x</button></div>
        <p className="text-[13px] text-muted mb-4">Insert a common question with one click. It is added to the last section.</p>
        <div className="grid grid-cols-2 gap-2">
          {QUESTION_LIBRARY.map((q) => (
            <button key={q.key} onClick={() => onInsert(q)} className="text-left px-3 py-2.5 rounded-[9px] border border-line hover:border-lime hover:bg-lime-soft transition">
              <div className="text-[13px] font-semibold text-ink">{q.label}</div>
              <div className="mono text-[10px] text-muted-2">{qtype(q.type)?.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Templates modal ---------------- */
function TemplatesModal({ onLoad, onClose }: { onLoad: (k: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/45 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-[16px] max-w-[560px] w-full p-6 shadow-[0_30px_70px_-20px_rgba(11,38,71,.5)] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h2 className="text-[19px] font-bold text-ink">Templates</h2><button onClick={onClose} className="text-muted-2 hover:text-ink">x</button></div>
        <p className="text-[13px] text-muted mb-4">Load a ready-made questionnaire and customise it. This replaces the current draft.</p>
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => { if (confirm("Load this template? It replaces the current questions.")) onLoad(t.key); }} className="text-left px-4 py-3 rounded-[10px] border border-line hover:border-lime hover:bg-lime-soft transition">
              <div className="flex items-center justify-between"><div className="text-[14px] font-semibold text-ink">{t.name}</div><span className="mono text-[10px] text-muted-2">{t.questions.length} questions</span></div>
              <div className="text-[12px] text-muted mt-0.5">{t.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Delete modal ---------------- */
function DeleteModal({ name, respCount, deleting, confirmText, setConfirmText, onArchive, onPermanent, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => !deleting && onClose()}>
      <div className="bg-surface rounded-[16px] p-6 max-w-[460px] w-full shadow-[0_30px_70px_-20px_rgba(11,38,71,.5)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[19px] font-bold text-ink mb-1">Delete questionnaire</h2>
        <p className="text-[13.5px] text-muted mb-4">Choose how to remove <b>{name}</b>.</p>
        <div className="border border-line rounded-[12px] p-4 mb-3">
          <div className="flex items-center justify-between mb-1"><b className="text-[14px] text-ink">Archive</b><span className="mono text-[10px] text-lime-deep">recoverable</span></div>
          <p className="text-[12.5px] text-muted mb-3">Hides it from active use. Responses untouched; can be restored.</p>
          <button className="btn btn-ghost h-9 px-4 text-[13px]" onClick={onArchive} disabled={deleting}>Archive questionnaire</button>
        </div>
        <div className="border border-[#f3d5cf] bg-[#fdf3f1] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-1"><b className="text-[14px] text-signal">Permanent delete</b><span className="mono text-[10px] text-signal">irreversible</span></div>
          <p className="text-[12.5px] text-muted mb-2">Removes the questionnaire and all versions.{respCount > 0 && <span className="text-signal"> This study has {respCount} response{respCount > 1 ? "s" : ""}.</span>}</p>
          <p className="text-[12px] text-muted mb-2">Type <b className="mono">DELETE</b> to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="w-full text-[14px] border border-line rounded-[9px] p-2.5 mb-3 focus:outline-none focus:border-signal" />
          <button className="btn h-9 px-4 text-[13px] bg-signal text-white hover:opacity-90 disabled:opacity-40" onClick={onPermanent} disabled={deleting || confirmText !== "DELETE"}>{deleting ? "Deleting..." : "Permanently delete"}</button>
        </div>
        <div className="text-right mt-4"><button className="text-[13px] text-muted hover:text-ink" onClick={onClose} disabled={deleting}>Cancel</button></div>
      </div>
    </div>
  );
}
