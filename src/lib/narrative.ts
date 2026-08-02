// Narrative engine: turns survey data into formal academic prose (British English).
// Rule-based now; structured so an AI layer can elevate it later.
import { Question, summarise } from "./analytics";
import { crossTab, pStars, tTest, anova, correlation } from "./statistics";

// ---- phrasing helpers ----

// Express a proportion in cautious academic language.
export function proportionPhrase(pct: number): string {
  if (pct >= 95) return "the overwhelming majority";
  if (pct >= 85) return "the vast majority";
  if (pct >= 75) return "roughly three-quarters";
  if (pct >= 66) return "approximately two-thirds";
  if (pct >= 60) return "a clear majority";
  if (pct >= 52) return "a slim majority";
  if (pct >= 48) return "approximately half";
  if (pct >= 40) return "a substantial proportion";
  if (pct >= 33) return "around one-third";
  if (pct >= 25) return "approximately a quarter";
  if (pct >= 15) return "a notable minority";
  if (pct >= 8) return "a small proportion";
  return "a very small proportion";
}

function pctText(pct: number): string { return pct.toFixed(1) + "%"; }

// A hedged verb for reporting, to keep an appropriately cautious register.
function reportVerb(): string { return ["indicates", "suggests", "points to", "reflects"][0]; }

// ---- per-question findings prose ----
export function questionNarrative(q: Question, subs: any[]): string {
  const s = summarise(q, subs);
  if (s.n === 0) return `No responses were recorded for the item "${q.label}", and it is therefore not discussed further here.`;

  if (s.kind === "choice") {
    const rows = [...s.rows].sort((a, b) => b.count - a.count);
    const top = rows[0];
    const second = rows[1];
    let out = `When asked "${q.label.replace(/\?$/, "")}?", ${proportionPhrase(top.pct)} of respondents (${top.count} of ${s.n}, ${pctText(top.pct)}) selected "${top.label}".`;
    if (second && second.count > 0) {
      out += ` This was followed by "${second.label}", cited by ${pctText(second.pct)} of the sample (${second.count} respondent${second.count === 1 ? "" : "s"}).`;
    }
    // interpretation for binary yes/no
    if (rows.length === 2 && /^(yes|no)$/i.test(top.label)) {
      if (top.pct >= 70) out += ` This distribution ${reportVerb()} a strong tendency towards "${top.label}" within the study area, and may be regarded as a substantively meaningful pattern rather than a marginal one.`;
      else if (top.pct >= 55) out += ` While "${top.label}" predominates, the margin is modest, and the finding should be interpreted with a degree of caution.`;
      else out += ` The responses are relatively evenly divided, suggesting no clear consensus among respondents on this question.`;
    } else if (top.pct >= 50) {
      out += ` The concentration of responses around a single category ${reportVerb()} a degree of consensus among respondents on this item.`;
    } else {
      out += ` Responses were distributed across several categories, indicating a diversity of views rather than a dominant position.`;
    }
    return out;
  }

  if (s.kind === "num") {
    const mean = s.mean;
    // use the scale's natural midpoint where a config exists, else observed midpoint
    const scaleMin = s.min, scaleMax = s.max;
    const mid = (scaleMin + scaleMax) / 2;
    const band = (scaleMax - scaleMin) * 0.12;
    const tone = mean > mid + band ? "towards the upper end of the scale"
      : mean < mid - band ? "towards the lower end of the scale"
      : "close to the mid-point of the scale";
    const favour = mean > mid + band ? "a generally favourable"
      : mean < mid - band ? "a generally unfavourable"
      : "a broadly neutral";
    let out = `Responses to "${q.label.replace(/\?$/, "")}" yielded a mean of ${mean.toFixed(2)} (median ${s.median.toFixed(2)}, SD ${s.sd.toFixed(2)}) on a scale ranging from ${scaleMin} to ${scaleMax}, based on ${s.n} valid response${s.n === 1 ? "" : "s"}.`;
    out += ` The average response lies ${tone}, suggesting ${favour} assessment among respondents overall.`;
    if (s.sd > (scaleMax - scaleMin) / 4) out += ` The relatively large standard deviation points to considerable variability in responses, and the mean is therefore best read as a summary of a fairly dispersed distribution.`;
    else out += ` The comparatively small standard deviation indicates that responses clustered closely around the mean.`;
    return out;
  }

  // text
  return `The item "${q.label}" elicited ${s.n} open-ended response${s.n === 1 ? "" : "s"}. As qualitative material, these are not amenable to statistical summary and are best examined in full in the appendix; representative excerpts are provided where relevant.`;
}

// ---- executive summary prose ----
export function executiveNarrative(opts: {
  studyName: string; moduleName: string; n: number; regions: string[]; consts: number;
  first?: string; last?: string; dq: number; flagged: number; questions: Question[]; subs: any[];
}): string {
  const { studyName, moduleName, n, regions, consts, first, last, dq, flagged, questions, subs } = opts;
  const paras: string[] = [];

  // opening
  let p1 = `This report presents the findings of ${studyName}, conducted under the ${moduleName} programme.`;
  p1 += ` The study is based on ${n} response${n === 1 ? "" : "s"}`;
  if (first && last && first !== last) p1 += ` gathered between ${formatDate(first)} and ${formatDate(last)}`;
  else if (first) p1 += ` gathered on ${formatDate(first)}`;
  if (regions.length) p1 += `, spanning ${regions.length} region${regions.length === 1 ? "" : "s"} (${listPhrase(regions)}) and ${consts} constituenc${consts === 1 ? "y" : "ies"}`;
  p1 += `.`;
  paras.push(p1);

  // data quality
  let p2 = `Following automated data-quality screening, ${dq}% of responses were retained as valid`;
  p2 += flagged > 0 ? `, with ${flagged} response${flagged === 1 ? "" : "s"} flagged for review and treated with appropriate caution in the analysis that follows.` : `, and no responses were flagged as problematic.`;
  paras.push(p2);

  // headline findings (top 3 choice questions)
  const highlights: string[] = [];
  questions.forEach((q) => {
    const s = summarise(q, subs);
    if (s.kind === "choice" && s.n >= 3) {
      const top = [...s.rows].sort((a, b) => b.count - a.count)[0];
      if (top && top.pct >= 40) highlights.push(`${proportionPhrase(top.pct)} of respondents (${pctText(top.pct)}) reported "${top.label}" in response to "${q.label.replace(/\?$/, "")}"`);
    } else if (s.kind === "num" && s.n >= 3) {
      highlights.push(`the mean rating for "${q.label.replace(/\?$/, "")}" was ${s.mean.toFixed(2)} on a ${s.min}\u2013${s.max} scale`);
    }
  });
  if (highlights.length) {
    let p3 = `Among the principal findings, ` + highlights.slice(0, 3).map((h, i) => i === 0 ? h : (i === Math.min(highlights.length, 3) - 1 ? "and " + h : h)).join("; ") + `.`;
    p3 += ` These and further results are examined in detail in the sections that follow.`;
    paras.push(p3);
  }

  return paras.join("\n\n");
}

// ---- key findings as written statements ----
export function keyFindings(questions: Question[], subs: any[], regionCounts: { name: string; count: number; pct: number }[]): string[] {
  const out: string[] = [];
  questions.forEach((q) => {
    const s = summarise(q, subs);
    if (s.kind === "choice" && s.n >= 3) {
      const top = [...s.rows].sort((a, b) => b.count - a.count)[0];
      if (top && top.pct >= 55) out.push(`${capitalise(proportionPhrase(top.pct))} of respondents (${pctText(top.pct)}) selected "${top.label}" for "${q.label.replace(/\?$/, "")}".`);
    }
    if (s.kind === "num" && s.n >= 3) {
      const mid = (s.min + s.max) / 2;
      if (s.mean >= mid + (s.max - s.min) * 0.15) out.push(`"${q.label.replace(/\?$/, "")}" attracted notably favourable ratings (mean ${s.mean.toFixed(2)} of ${s.max}).`);
      else if (s.mean <= mid - (s.max - s.min) * 0.15) out.push(`"${q.label.replace(/\?$/, "")}" attracted comparatively low ratings (mean ${s.mean.toFixed(2)} of ${s.max}).`);
    }
  });
  if (regionCounts.length >= 2) {
    const lead = regionCounts[0];
    out.push(`Fieldwork coverage was concentrated in ${lead.name}, which accounted for ${pctText(lead.pct)} of all responses.`);
  }
  return out.length ? out : ["The volume of data collected to date is modest; the findings below should be regarded as preliminary and indicative rather than conclusive."];
}

// ---- group comparison prose ----
export function comparisonNarrative(numQ: Question, groupQ: Question, subs: any[]): string | null {
  const groupsMap: Record<string, number[]> = {};
  subs.forEach((s) => { const g = String(s?.payload?.[groupQ.code] ?? ""); const v = Number(s?.payload?.[numQ.code]); if (g && !isNaN(v)) (groupsMap[g] ||= []).push(v); });
  const labelFor = (code: string) => (groupQ.options?.find((o: any) => o.code === code)?.label) || code;
  const groups = Object.entries(groupsMap).filter(([, v]) => v.length >= 2).map(([code, v]) => ({ label: labelFor(code), values: v, mean: v.reduce((a, b) => a + b, 0) / v.length }));
  if (groups.length < 2) return null;
  groups.sort((a, b) => b.mean - a.mean);
  const hi = groups[0], lo = groups[groups.length - 1];

  let out = `Comparing "${numQ.label.replace(/\?$/, "")}" across categories of "${groupQ.label.replace(/\?$/, "")}", the highest mean rating was observed among respondents reporting "${hi.label}" (${hi.mean.toFixed(2)}), and the lowest among those reporting "${lo.label}" (${lo.mean.toFixed(2)}).`;

  if (groups.length === 2) {
    const tt = tTest(groups[0].values, groups[1].values);
    out += tt.p < 0.05
      ? ` An independent-samples t-test indicated that this difference is statistically significant, t(${tt.df.toFixed(1)}) = ${tt.t.toFixed(2)}, ${pStars(tt.p)}. The difference may therefore be regarded as unlikely to have arisen by chance alone.`
      : ` An independent-samples t-test did not find this difference to be statistically significant, t(${tt.df.toFixed(1)}) = ${tt.t.toFixed(2)}, ${pStars(tt.p)}. Any apparent difference should accordingly be interpreted with caution.`;
  } else {
    const av = anova(groups.map((g) => ({ label: g.label, values: g.values })));
    out += av.p < 0.05
      ? ` A one-way analysis of variance indicated statistically significant differences among the groups, F(${av.df1}, ${av.df2}) = ${av.F.toFixed(2)}, ${pStars(av.p)}.`
      : ` A one-way analysis of variance did not reveal statistically significant differences among the groups, F(${av.df1}, ${av.df2}) = ${av.F.toFixed(2)}, ${pStars(av.p)}.`;
  }
  return out;
}

// ---- interpretation / discussion ----
export function interpretation(questions: Question[], subs: any[], regions: string[]): string {
  const paras: string[] = [];
  const numQs = questions.filter((q) => ["rating", "number", "star_rating", "slider"].includes(q.type));

  // correlation observation
  if (numQs.length >= 2) {
    let strongest: { a: string; b: string; r: number; n: number } | null = null;
    for (let i = 0; i < numQs.length; i++) for (let j = i + 1; j < numQs.length; j++) {
      const c = correlation(numQs[i].code, numQs[j].code, subs);
      if (c.n >= 4 && (!strongest || Math.abs(c.r) > Math.abs(strongest.r))) strongest = { a: numQs[i].label, b: numQs[j].label, r: c.r, n: c.n };
    }
    if (strongest && Math.abs(strongest.r) >= 0.3) {
      const strength = Math.abs(strongest.r) >= 0.7 ? "strong" : Math.abs(strongest.r) >= 0.5 ? "moderate" : "weak-to-moderate";
      paras.push(`A ${strength} ${strongest.r > 0 ? "positive" : "negative"} association was observed between "${strongest.a.replace(/\?$/, "")}" and "${strongest.b.replace(/\?$/, "")}" (r = ${strongest.r.toFixed(2)}, n = ${strongest.n}). ${strongest.r > 0 ? "Respondents rating one item favourably tended also to rate the other favourably" : "More favourable ratings on one item tended to accompany less favourable ratings on the other"}. As with all correlational findings, this association should not be read as evidence of a causal relationship.`);
    }
  }

  paras.push(`Taken together, the findings should be understood within the limits of the present sample. The analysis reflects the views of those who participated and, given the sample size and coverage, may not be fully representative of the wider population. The results are best treated as indicative, and would benefit from corroboration through continued data collection and, where appropriate, complementary qualitative enquiry.`);

  return paras.join("\n\n");
}

// ---- helpers ----
function formatDate(d: string): string {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch { return d; }
}
function listPhrase(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}
function capitalise(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
