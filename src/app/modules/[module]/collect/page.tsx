"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";
import { qtype } from "@/lib/questionTypes";
import QuestionInput from "@/components/collect/QuestionInput";
import StudyContextBar from "@/components/StudyContextBar";

interface QDef { code: string; label: string; type: string; required?: boolean; options?: any[]; columns?: any[]; config?: any; validation?: any; description?: string; help?: string; page?: number; section?: string; skip?: any; }

export default function CollectPage() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  const { user, profile, projects, activeStudyId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [qnName, setQnName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QDef[]>([]);
  const [pageTitles, setPageTitles] = useState<string[]>(["Page 1"]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [page, setPage] = useState(0);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [constituencies, setConstituencies] = useState<{ id: string; name: string; parent_id: string }[]>([]);
  const [regionId, setRegionId] = useState("");
  const [geoUnitId, setGeoUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const studies = mod ? projects.filter((p) => p.project_type === mod.type) : [];
  const activeStudy = studies.find((s) => s.id === activeStudyId) || null;

  useEffect(() => {
    (async () => {
      if (!activeStudyId) { setLoading(false); return; }
      setLoading(true); setDone(false); setAnswers({}); setPage(0);
      const sb = supabase();
      // published questionnaire
      const { data: qns } = await sb.from("questionnaires").select("*").eq("project_id", activeStudyId).eq("status", "published").order("updated_at", { ascending: false });
      const chosen = (qns || [])[0];
      if (chosen && (chosen as any).current_version_id) {
        setQnName(chosen.name);
        const { data: ver } = await sb.from("questionnaire_versions").select("*").eq("id", (chosen as any).current_version_id).single();
        const d: any = (ver as any)?.definition || {};
        const qs: QDef[] = Array.isArray(d.questions) ? d.questions : [];
        setQuestions(qs);
        setPageTitles(d.pageTitles && d.pageTitles.length ? d.pageTitles : ["Page 1"]);
        // seed defaults
        const seed: Record<string, any> = {};
        qs.forEach((q) => { if (q && (q as any).defaultValue) seed[q.code] = (q as any).defaultValue; });
        setAnswers(seed);
      } else { setQnName(null); setQuestions([]); }
      // geo pickers
      const { data: geo } = await sb.from("geo_units").select("id,name,level,parent_id").in("level", ["region", "constituency"]).order("name");
      const g = geo || [];
      setRegions(g.filter((x: any) => x.level === "region"));
      setConstituencies(g.filter((x: any) => x.level === "constituency"));
      startedAt.current = Date.now();
      setLoading(false);
    })();
  }, [activeStudyId]);

  // skip logic: decide if a question is visible given current answers
  function visible(q: QDef): boolean {
    if ((q as any).visibility === "hidden" && !q.skip) return false;
    const sk = q.skip;
    if (!sk || !sk.whenCode) return true;
    const av = answers[sk.whenCode];
    const match = Array.isArray(av) ? av.includes(sk.equals) : String(av ?? "") === String(sk.equals ?? "");
    if (sk.action === "hide") return !match;
    return match; // show when match
  }

  const pageQuestions = useMemo(() => questions.filter((q) => (q.page || 0) === page && visible(q)), [questions, page, answers]);
  const pages = pageTitles.length;

  function setAnswer(code: string, v: any) { setAnswers((a) => ({ ...a, [code]: v })); }

  function validatePage(): string | null {
    for (const q of pageQuestions) {
      const v = answers[q.code];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (q.required && empty) return `"${q.label}" is required.`;
      if (q.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `"${q.label}" needs a valid email.`;
      if (q.type === "number" && v != null && v !== "") {
        if (q.validation?.min != null && Number(v) < q.validation.min) return `"${q.label}" must be at least ${q.validation.min}.`;
        if (q.validation?.max != null && Number(v) > q.validation.max) return `"${q.label}" must be at most ${q.validation.max}.`;
      }
    }
    return null;
  }

  function next() { const err = validatePage(); if (err) { setMsg(err); return; } setMsg(""); setPage((p) => Math.min(p + 1, pages - 1)); }
  function back() { setMsg(""); setPage((p) => Math.max(p - 1, 0)); }

  async function submit() {
    const err = validatePage(); if (err) { setMsg(err); return; }
    if (!geoUnitId && !regionId) { setMsg("Select at least a region for this interview."); return; }
    setSubmitting(true); setMsg("");
    try {
      const sb = supabase();
      const clientId = (crypto as any)?.randomUUID ? crypto.randomUUID() : "c_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const duration = Math.round((Date.now() - startedAt.current) / 1000);
      const row: any = {
        client_id: clientId, project_id: activeStudyId, enumerator_id: user?.id || null,
        geo_unit_id: geoUnitId || regionId || null, captured_at: new Date().toISOString(),
        status: "accepted", payload: answers, duration_seconds: duration,
      };
      const { error } = await sb.from("submissions").insert(row);
      if (error) throw error;
      setDone(true);
    } catch (e: any) { setMsg("Submit failed: " + (e?.message || "")); }
    setSubmitting(false);
  }

  function newResponse() { setAnswers({}); setPage(0); setGeoUnitId(""); setDone(false); setMsg(""); startedAt.current = Date.now(); }

  if (!mod) return notFound();

  if (!activeStudyId || !activeStudy) {
    return (
      <ModuleShell slug={slug} title={`${mod.label} - Collect`}>
        <StudyContextBar studies={studies} />
        <div className="card card-accent p-12 text-center">
          <div className="kicker mb-3">No study selected</div>
          <h2 className="text-[22px] font-bold text-ink mb-2">Choose a study to collect responses</h2>
          <Link href={`/modules/${slug}/studies`} className="btn inline-flex mt-2">Go to Studies</Link>
        </div>
      </ModuleShell>
    );
  }

  const constForRegion = constituencies.filter((c) => !regionId || c.parent_id === regionId);

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Collect`}>
      <StudyContextBar studies={studies} />

      <div className="max-w-[720px] mx-auto">
        {loading ? (
          <div className="text-muted mono text-[13px] py-10 text-center">Loading questionnaire...</div>
        ) : !qnName ? (
          <div className="card card-accent p-10 text-center">
            <h2 className="text-[20px] font-bold text-ink mb-2">No published questionnaire</h2>
            <p className="text-muted text-[14px] max-w-md mx-auto mb-4">Publish a questionnaire in the Builder before collecting responses for this study.</p>
            <Link href={`/modules/${slug}/builder`} className="btn inline-flex">Open Builder</Link>
          </div>
        ) : done ? (
          <div className="card card-accent p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-lime-soft text-lime-deep grid place-items-center mx-auto mb-3 text-[24px] font-bold">OK</div>
            <h2 className="text-[20px] font-bold text-ink mb-1">Response recorded</h2>
            <p className="text-muted text-[14px] mb-5">The interview has been submitted and is now in the dashboard.</p>
            <div className="flex gap-2 justify-center">
              <button className="btn btn-accent" onClick={newResponse}>New response</button>
              <Link href={`/modules/${slug}/dashboard`} className="btn btn-ghost">View dashboard</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="kicker mb-1">Collecting &middot; {activeStudy.name}</div>
              <h1 className="text-[22px] font-extrabold text-ink">{qnName}</h1>
            </div>

            {/* progress */}
            {pages > 1 && (
              <div className="flex items-center gap-1.5 mb-4">
                {pageTitles.map((pt, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= page ? "bg-lime" : "bg-line"}`} title={pt} />
                ))}
              </div>
            )}

            {/* geo capture on first page */}
            {page === 0 && (
              <div className="card p-5 mb-4">
                <div className="kicker mb-3">Interview location</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Region</label>
                    <select className="w-full text-[14px] border border-line rounded-[9px] px-3 py-2.5" value={regionId} onChange={(e) => { setRegionId(e.target.value); setGeoUnitId(""); }}>
                      <option value="">Select region...</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mono text-[9px] uppercase text-muted-2 mb-1.5">Constituency</label>
                    <select className="w-full text-[14px] border border-line rounded-[9px] px-3 py-2.5" value={geoUnitId} onChange={(e) => setGeoUnitId(e.target.value)} disabled={!regionId}>
                      <option value="">{regionId ? "Select constituency..." : "Pick a region first"}</option>
                      {constForRegion.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* questions on this page, grouped by section */}
            <div className="flex flex-col gap-4">
              {pageTitles.length > 1 && <div className="mono text-[11px] text-blue">{pageTitles[page]}</div>}
              {pageQuestions.length === 0 && <div className="card p-6 text-center text-muted-2 text-[13px]">No questions on this page.</div>}
              {groupBySection(pageQuestions).map((grp) => (
                <div key={grp.section} className="card p-5">
                  {grp.section && <div className="border-l-4 border-lime pl-3 mb-4"><h3 className="text-[15px] font-bold text-ink">{grp.section}</h3></div>}
                  <div className="flex flex-col gap-5">
                    {grp.items.map((q, i) => (
                      <div key={q.code}>
                        <div className="text-[14.5px] font-semibold text-ink mb-1">{q.label} {q.required && <span className="text-signal">*</span>}</div>
                        {q.description && <div className="text-[12.5px] text-muted mb-2">{q.description}</div>}
                        <QuestionInput q={q} value={answers[q.code]} onChange={(v) => setAnswer(q.code, v)} />
                        {q.help && <div className="mono text-[11px] text-muted-2 mt-1.5">{q.help}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {msg && <div className="text-signal text-[13px] mt-3">{msg}</div>}

            {/* nav */}
            <div className="flex items-center justify-between mt-5">
              <button className="btn btn-ghost disabled:opacity-40" onClick={back} disabled={page === 0}>Back</button>
              <span className="mono text-[11px] text-muted-2">Page {page + 1} of {pages}</span>
              {page < pages - 1
                ? <button className="btn" onClick={next}>Next</button>
                : <button className="btn btn-accent" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit response"}</button>}
            </div>
          </>
        )}
      </div>
    </ModuleShell>
  );
}

function groupBySection(qs: QDef[]): { section: string; items: QDef[] }[] {
  const out: { section: string; items: QDef[] }[] = [];
  qs.forEach((q) => {
    const sec = (q as any).section || "";
    let g = out.find((x) => x.section === sec);
    if (!g) { g = { section: sec, items: [] }; out.push(g); }
    g.items.push(q);
  });
  return out;
}
