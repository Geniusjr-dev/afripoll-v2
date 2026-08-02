// Report filter engine. Produces a filtered submissions array that every report section uses.
import { regionOf, constOf } from "./orgData";

export interface FilterState {
  region: string;            // region name, "" = all
  constituency: string;      // constituency name
  dateFrom: string;          // yyyy-mm-dd
  dateTo: string;
  enumerator: string;        // enumerator id
  // dynamic variable filters: questionCode -> selected option code ("" = all)
  vars: Record<string, string>;
  // drill-down: quick single-variable filter set by clicking a chart segment
  drill?: { code: string; value: string } | null;
}

export const emptyFilter = (): FilterState => ({ region: "", constituency: "", dateFrom: "", dateTo: "", enumerator: "", vars: {}, drill: null });

export function filterSubs(subs: any[], gidx: Record<string, any>, f: FilterState): any[] {
  return subs.filter((s) => {
    if (f.region && regionOf(gidx, s.geo_unit_id) !== f.region) return false;
    if (f.constituency && constOf(gidx, s.geo_unit_id) !== f.constituency) return false;
    if (f.enumerator && s.enumerator_id !== f.enumerator) return false;
    const day = (s.captured_at || "").slice(0, 10);
    if (f.dateFrom && day && day < f.dateFrom) return false;
    if (f.dateTo && day && day > f.dateTo) return false;
    for (const code in f.vars) {
      const want = f.vars[code]; if (!want) continue;
      const v = s?.payload?.[code];
      if (Array.isArray(v)) { if (!v.map(String).includes(want)) return false; }
      else if (String(v ?? "") !== want) return false;
    }
    if (f.drill && f.drill.value) {
      const v = s?.payload?.[f.drill.code];
      if (Array.isArray(v)) { if (!v.map(String).includes(f.drill.value)) return false; }
      else if (String(v ?? "") !== f.drill.value) return false;
    }
    return true;
  });
}

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.region) n++; if (f.constituency) n++; if (f.enumerator) n++;
  if (f.dateFrom) n++; if (f.dateTo) n++;
  n += Object.values(f.vars).filter(Boolean).length;
  if (f.drill && f.drill.value) n++;
  return n;
}

export function filterSummary(f: FilterState, labelFor: (code: string, val: string) => string): string {
  const parts: string[] = [];
  if (f.region) parts.push(f.region);
  if (f.constituency) parts.push(f.constituency);
  if (f.dateFrom || f.dateTo) parts.push(`${f.dateFrom || "start"} to ${f.dateTo || "end"}`);
  for (const code in f.vars) { if (f.vars[code]) parts.push(labelFor(code, f.vars[code])); }
  if (f.drill && f.drill.value) parts.push(labelFor(f.drill.code, f.drill.value));
  return parts.join(" | ");
}
