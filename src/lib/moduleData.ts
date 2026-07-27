"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { regionOf, constOf } from "./orgData";

// Module-scoped aggregate data. Given the project ids that belong to a module,
// it pulls submissions, questionnaires, flags and geo for just those studies.
// Reused by every module (MP Performance is the reference implementation).

export interface ModuleData {
  loading: boolean;
  subs: any[];
  qn: any[];
  flags: any[];
  users: any[];
  gidx: Record<string, any>;
}

export function useModuleData(projectIds: string[]): ModuleData {
  const [d, setD] = useState<ModuleData>({ loading: true, subs: [], qn: [], flags: [], users: [], gidx: {} });
  const key = projectIds.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabase();
      if (projectIds.length === 0) {
        if (!cancelled) setD({ loading: false, subs: [], qn: [], flags: [], users: [], gidx: {} });
        return;
      }
      try {
        const [subsR, qnR, usersR, geoR] = await Promise.all([
          sb.from("submissions").select("client_id,project_id,enumerator_id,geo_unit_id,captured_at,status,gps_accuracy_m,duration_seconds").in("project_id", projectIds).in("status", ["accepted", "complete", "staged"]),
          sb.from("questionnaires").select("id,project_id,name,status,updated_at").in("project_id", projectIds),
          sb.from("users").select("id,full_name,role,is_active"),
          sb.from("geo_units").select("id,name,level,parent_id"),
        ]);
        const subs = subsR.data || [], qn = qnR.data || [], users = usersR.data || [], geo = geoR.data || [];
        const gidx: Record<string, any> = {}; geo.forEach((g: any) => (gidx[g.id] = g));
        let flags: any[] = [];
        const ids = subs.map((s: any) => s.client_id);
        for (let i = 0; i < ids.length; i += 300) {
          const { data } = await sb.from("submission_flags").select("flag_type,severity,submission_id").in("submission_id", ids.slice(i, i + 300));
          if (data) flags = flags.concat(data);
        }
        if (!cancelled) setD({ loading: false, subs, qn, users, flags, gidx });
      } catch {
        if (!cancelled) setD({ loading: false, subs: [], qn: [], flags: [], users: [], gidx: {} });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return d;
}

export { regionOf, constOf };
