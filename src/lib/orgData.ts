"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface OrgData {
  loading: boolean;
  subs: any[]; users: any[]; qn: any[]; flags: any[];
  gidx: Record<string, any>;
}
export function useOrgData(): OrgData {
  const [d, setD] = useState<OrgData>({ loading: true, subs: [], users: [], qn: [], flags: [], gidx: {} });
  useEffect(() => {
    (async () => {
      const sb = supabase();
      try {
        const [subsR, usersR, geoR, qnR] = await Promise.all([
          sb.from("submissions").select("client_id,project_id,enumerator_id,geo_unit_id,captured_at,status,gps_accuracy_m").in("status", ["accepted", "complete", "staged"]),
          sb.from("users").select("id,full_name,role,is_active"),
          sb.from("geo_units").select("id,name,level,parent_id"),
          sb.from("questionnaires").select("id,project_id,name,status,updated_at"),
        ]);
        const subs = subsR.data || [], users = usersR.data || [], geo = geoR.data || [], qn = qnR.data || [];
        const gidx: Record<string, any> = {}; geo.forEach((g: any) => (gidx[g.id] = g));
        let flags: any[] = [];
        const ids = subs.map((s: any) => s.client_id);
        for (let i = 0; i < ids.length; i += 300) {
          const { data } = await sb.from("submission_flags").select("flag_type,severity,submission_id").in("submission_id", ids.slice(i, i + 300));
          if (data) flags = flags.concat(data);
        }
        setD({ loading: false, subs, users, qn, flags, gidx });
      } catch {
        setD({ loading: false, subs: [], users: [], qn: [], flags: [], gidx: {} });
      }
    })();
  }, []);
  return d;
}

export const regionOf = (gidx: Record<string, any>, id: string) => climb(gidx, id, "region");
export const constOf = (gidx: Record<string, any>, id: string) => climb(gidx, id, "constituency");
function climb(gidx: Record<string, any>, id: string, level: string): string | null {
  let c = gidx[id], guard = 0;
  while (c && guard++ < 8) { if (c.level === level) return c.name; c = gidx[c.parent_id]; }
  return null;
}
