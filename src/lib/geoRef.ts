"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Loads geo reference lists (regions, districts, constituencies) from geo_units,
// used to populate election-specific selector question options with real data.
export interface GeoRef {
  loading: boolean;
  regions: { code: string; label: string }[];
  districts: { code: string; label: string }[];
  constituencies: { code: string; label: string }[];
}
export function useGeoRef(): GeoRef {
  const [d, setD] = useState<GeoRef>({ loading: true, regions: [], districts: [], constituencies: [] });
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase().from("geo_units").select("id,name,level").in("level", ["region", "district", "constituency"]).order("name");
        const g = data || [];
        const pick = (lvl: string) => g.filter((x: any) => x.level === lvl).map((x: any) => ({ code: x.id, label: x.name }));
        setD({ loading: false, regions: pick("region"), districts: pick("district"), constituencies: pick("constituency") });
      } catch {
        setD({ loading: false, regions: [], districts: [], constituencies: [] });
      }
    })();
  }, []);
  return d;
}

// Common Ghana parties as a sensible default for the party selector (editable).
export const DEFAULT_PARTIES = [
  { code: "ndc", label: "National Democratic Congress (NDC)" },
  { code: "npp", label: "New Patriotic Party (NPP)" },
  { code: "cpp", label: "Convention People's Party (CPP)" },
  { code: "gunion", label: "Ghana Union Movement (GUM)" },
  { code: "pnc", label: "People's National Convention (PNC)" },
  { code: "independent", label: "Independent" },
  { code: "other", label: "Other" },
];
