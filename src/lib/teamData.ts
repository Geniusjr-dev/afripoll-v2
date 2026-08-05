"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface TeamMember { id: string; full_name: string; role: string; organization_id?: string; responses: number; is_active: boolean; }
export interface Assignment { id: string; enumerator_id: string; geo_unit_id: string; project_id: string | null; }
export interface GeoUnit { id: string; name: string; level: string; parent_id: string | null; }

export interface TeamData {
  loading: boolean;
  members: TeamMember[];
  assignments: Assignment[];
  geo: GeoUnit[];
  assignmentsAvailable: boolean;   // false if the table doesn't exist yet
  refresh: () => void;
}

export function useTeamData(orgId: string | null | undefined, projectType?: string): TeamData {
  const [d, setD] = useState<TeamData>({ loading: true, members: [], assignments: [], geo: [], assignmentsAvailable: true, refresh: () => {} });

  const load = useCallback(async () => {
    setD((p) => ({ ...p, loading: true }));
    const sb = supabase();
    // members
    let membersQ = sb.from("users").select("id, full_name, role, organization_id, is_active");
    if (orgId) membersQ = membersQ.eq("organization_id", orgId);

    // Resolve the project ids that belong to the current module (by project_type).
    let moduleProjectIds: string[] | null = null;
    if (projectType) {
      let projQ = sb.from("projects").select("id").eq("project_type", projectType);
      if (orgId) projQ = projQ.eq("organization_id", orgId);
      const projR = await projQ;
      moduleProjectIds = (projR.data || []).map((p: any) => p.id);
    }

    // Count submissions, scoped to this module's projects when we have them.
    let subsQ = sb.from("submissions").select("enumerator_id, project_id");
    if (moduleProjectIds !== null) {
      if (moduleProjectIds.length === 0) subsQ = subsQ.eq("project_id", "00000000-0000-0000-0000-000000000000"); // no projects -> no rows
      else subsQ = subsQ.in("project_id", moduleProjectIds);
    }

    const [usersR, subsR, geoR] = await Promise.all([
      membersQ,
      subsQ,
      sb.from("geo_units").select("id,name,level,parent_id").in("level", ["region", "constituency"]).order("name"),
    ]);
    const users = usersR.data || [];
    const subs = subsR.data || [];
    const counts: Record<string, number> = {};
    subs.forEach((s: any) => { if (s.enumerator_id) counts[s.enumerator_id] = (counts[s.enumerator_id] || 0) + 1; });
    const members: TeamMember[] = users.map((u: any) => ({ id: u.id, full_name: u.full_name || "(unnamed)", role: u.role || "enumerator", organization_id: u.organization_id, responses: counts[u.id] || 0, is_active: u.is_active !== false }));

    // assignments (table may not exist yet)
    let assignments: Assignment[] = [];
    let assignmentsAvailable = true;
    try {
      const aR = await sb.from("area_assignments").select("id, enumerator_id, geo_unit_id, project_id");
      if (aR.error) { assignmentsAvailable = false; } else { assignments = aR.data || []; }
    } catch { assignmentsAvailable = false; }

    setD({ loading: false, members, assignments, geo: geoR.data || [], assignmentsAvailable, refresh: load });
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  return { ...d, refresh: load };
}

export async function addAssignment(orgId: string, enumeratorId: string, geoUnitId: string, projectId: string | null, assignedBy: string) {
  const sb = supabase();
  return sb.from("area_assignments").insert({ organization_id: orgId, enumerator_id: enumeratorId, geo_unit_id: geoUnitId, project_id: projectId, assigned_by: assignedBy });
}
export async function removeAssignment(id: string) {
  return supabase().from("area_assignments").delete().eq("id", id);
}

// ---- single member work profile ----
export interface MemberWork {
  loading: boolean;
  total: number;
  activeDays: number;
  avgPerDay: number;
  avgDuration: number;      // seconds
  flagged: number;
  firstDate?: string;
  lastDate?: string;
  perDay: { day: string; count: number }[];
  areas: { name: string; count: number }[];
  recent: { id: string; captured_at: string; area: string; duration: number | null }[];
}

export async function loadMemberWork(memberId: string, projectType?: string, orgId?: string | null): Promise<MemberWork> {
  const sb = supabase();
  // scope to this module's projects when a project_type is given
  let moduleProjectIds: string[] | null = null;
  if (projectType) {
    let projQ = sb.from("projects").select("id").eq("project_type", projectType);
    if (orgId) projQ = projQ.eq("organization_id", orgId);
    const projR = await projQ;
    moduleProjectIds = (projR.data || []).map((p: any) => p.id);
  }
  let subsQ = sb.from("submissions").select("client_id, captured_at, geo_unit_id, duration_seconds").eq("enumerator_id", memberId).order("captured_at", { ascending: false });
  if (moduleProjectIds !== null) {
    if (moduleProjectIds.length === 0) subsQ = subsQ.eq("project_id", "00000000-0000-0000-0000-000000000000");
    else subsQ = subsQ.in("project_id", moduleProjectIds);
  }
  const [subsR, geoR, flagsR] = await Promise.all([
    subsQ,
    sb.from("geo_units").select("id,name,level,parent_id"),
    sb.from("submission_flags").select("submission_id"),
  ]);
  const subs = subsR.data || [];
  const geo = geoR.data || [];
  const gidx: Record<string, any> = {}; geo.forEach((g: any) => (gidx[g.id] = g));
  const climb = (id: string, level: string): string => {
    let cur = gidx[id]; let guard = 0;
    while (cur && guard++ < 8) { if (cur.level === level) return cur.name; cur = cur.parent_id ? gidx[cur.parent_id] : null; }
    return "";
  };
  const nameOf = (id: string) => gidx[id]?.name || climb(id, "constituency") || climb(id, "region") || "Unknown";

  const days: Record<string, number> = {};
  const areas: Record<string, number> = {};
  const durations: number[] = [];
  subs.forEach((s: any) => {
    const day = (s.captured_at || "").slice(0, 10);
    if (day) days[day] = (days[day] || 0) + 1;
    const a = nameOf(s.geo_unit_id); areas[a] = (areas[a] || 0) + 1;
    if (typeof s.duration_seconds === "number" && s.duration_seconds > 0) durations.push(s.duration_seconds);
  });
  const flagIds = new Set((flagsR.data || []).map((f: any) => f.submission_id));
  const flagged = subs.filter((s: any) => flagIds.has(s.client_id)).length;
  const dayList = Object.keys(days).sort();
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  return {
    loading: false,
    total: subs.length,
    activeDays: dayList.length,
    avgPerDay: dayList.length ? Math.round((subs.length / dayList.length) * 10) / 10 : 0,
    avgDuration, flagged,
    firstDate: dayList[0], lastDate: dayList[dayList.length - 1],
    perDay: dayList.map((d) => ({ day: d, count: days[d] })),
    areas: Object.entries(areas).map(([name, count]) => ({ name, count: count as number })).sort((a, b) => b.count - a.count),
    recent: subs.slice(0, 15).map((s: any) => ({ id: s.client_id, captured_at: s.captured_at, area: nameOf(s.geo_unit_id), duration: s.duration_seconds ?? null })),
  };
}
