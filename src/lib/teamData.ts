"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface TeamMember { id: string; full_name: string; role: string; organization_id?: string; responses: number; }
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

export function useTeamData(orgId: string | null | undefined): TeamData {
  const [d, setD] = useState<TeamData>({ loading: true, members: [], assignments: [], geo: [], assignmentsAvailable: true, refresh: () => {} });

  const load = useCallback(async () => {
    setD((p) => ({ ...p, loading: true }));
    const sb = supabase();
    // members
    let membersQ = sb.from("users").select("id, full_name, role, organization_id");
    if (orgId) membersQ = membersQ.eq("organization_id", orgId);
    const [usersR, subsR, geoR] = await Promise.all([
      membersQ,
      sb.from("submissions").select("enumerator_id"),
      sb.from("geo_units").select("id,name,level,parent_id").in("level", ["region", "constituency"]).order("name"),
    ]);
    const users = usersR.data || [];
    const subs = subsR.data || [];
    const counts: Record<string, number> = {};
    subs.forEach((s: any) => { if (s.enumerator_id) counts[s.enumerator_id] = (counts[s.enumerator_id] || 0) + 1; });
    const members: TeamMember[] = users.map((u: any) => ({ id: u.id, full_name: u.full_name || "(unnamed)", role: u.role || "enumerator", organization_id: u.organization_id, responses: counts[u.id] || 0 }));

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
