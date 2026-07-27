"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Question } from "./analytics";

// Loads a single study's published questionnaire (questions) + its submissions.
// Defensive about schema: questions may live on questionnaires.schema or a versions table.

export interface StudyData {
  loading: boolean;
  questions: Question[];
  subs: any[];
  gidx: Record<string, any>;
  users: any[];
  flags: any[];
  qnName: string | null;
}

function extractQuestions(schema: any): Question[] {
  if (!schema) return [];
  // schema may be an array of questions, or { questions: [...] }, or { pages:[{questions}] }
  let arr: any[] = [];
  if (Array.isArray(schema)) arr = schema;
  else if (Array.isArray(schema.questions)) arr = schema.questions;
  else if (Array.isArray(schema.pages)) arr = schema.pages.flatMap((p: any) => p.questions || []);
  return arr.map((q: any) => ({
    code: q.code || q.id || q.name,
    label: q.label || q.title || q.text || q.code || "Question",
    type: q.type || "short_text",
    options: q.options || q.choices || [],
    config: q.config || {},
  })).filter((q: Question) => q.code);
}

export function useStudyData(studyId: string | null): StudyData {
  const [d, setD] = useState<StudyData>({ loading: true, questions: [], subs: [], gidx: {}, users: [], flags: [], qnName: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!studyId) { setD({ loading: false, questions: [], subs: [], gidx: {}, users: [], flags: [], qnName: null }); return; }
      const sb = supabase();
      try {
        // questionnaire: prefer published, else latest
        const { data: qns } = await sb.from("questionnaires")
          .select("*")
          .eq("project_id", studyId)
          .order("updated_at", { ascending: false });
        let questions: Question[] = [];
        let qnName: string | null = null;
        // DIAGNOSTIC: expose raw questionnaire shape for schema mapping
        try {
          if (typeof window !== "undefined") {
            (window as any).__afripoll_qn = qns;
            console.log("[AfriPoll] questionnaires for study:", qns);
            if (qns && qns[0]) {
              console.log("[AfriPoll] questionnaire columns:", Object.keys(qns[0]));
              console.log("[AfriPoll] first questionnaire full:", JSON.stringify(qns[0]).slice(0, 1500));
            }
          }
        } catch (e) {}
        const chosen = (qns || []).find((q: any) => q.status === "published") || (qns || [])[0];
        if (chosen) {
          qnName = chosen.name;
          questions = extractQuestions((chosen as any).schema);
          // questions live in questionnaire_versions, referenced by current_version_id
          if (questions.length === 0 && (chosen as any).current_version_id) {
            const { data: ver, error: verr } = await sb.from("questionnaire_versions")
              .select("*").eq("id", (chosen as any).current_version_id).single();
            try {
              if (typeof window !== "undefined") {
                console.log("[AfriPoll] version error:", verr?.message);
                console.log("[AfriPoll] version columns:", ver ? Object.keys(ver) : null);
                console.log("[AfriPoll] version full:", JSON.stringify(ver).slice(0, 1800));
              }
            } catch (e) {}
            if (ver) {
              questions = extractQuestions((ver as any).schema || (ver as any).questions || (ver as any).structure || (ver as any).definition || ver);
            }
          }
        }

        const [subsR, geoR, usersR] = await Promise.all([
          sb.from("submissions").select("client_id,project_id,enumerator_id,geo_unit_id,captured_at,status,payload").eq("project_id", studyId).in("status", ["accepted", "complete", "staged"]),
          sb.from("geo_units").select("id,name,level,parent_id"),
          sb.from("users").select("id,full_name,role"),
        ]);
        const subs = subsR.data || [], geo = geoR.data || [], users = usersR.data || [];
        try { if (typeof window !== "undefined" && subs[0]) { console.log("[AfriPoll] sample submission payload:", JSON.stringify(subs[0].payload).slice(0,1200)); } } catch(e){}
        const gidx: Record<string, any> = {}; geo.forEach((g: any) => (gidx[g.id] = g));
        let flags: any[] = [];
        const ids = subs.map((s: any) => s.client_id);
        for (let i = 0; i < ids.length; i += 300) {
          const { data } = await sb.from("submission_flags").select("flag_type,submission_id").in("submission_id", ids.slice(i, i + 300));
          if (data) flags = flags.concat(data);
        }
        if (!cancelled) setD({ loading: false, questions, subs, gidx, users, flags, qnName });
      } catch {
        if (!cancelled) setD({ loading: false, questions: [], subs: [], gidx: {}, users: [], flags: [], qnName: null });
      }
    })();
    return () => { cancelled = true; };
  }, [studyId]);

  return d;
}
