// Pure statistics for AfriPoll reports. No dependencies.
import { Question } from "./analytics";

export interface CrossTab {
  rowLabels: string[]; colLabels: string[];
  rowCodes: string[]; colCodes: string[];
  counts: number[][];          // [row][col]
  rowTotals: number[]; colTotals: number[]; grand: number;
  colPct: number[][];          // percent within column
  rowPct: number[][];          // percent within row
  chi2: number; df: number; pValue: number; cramersV: number;
  valid: boolean; note?: string;
}

function optionLabels(q: Question): { codes: string[]; labels: Record<string, string> } {
  const labels: Record<string, string> = {};
  if (q.type === "yes_no") { labels["yes"] = "Yes"; labels["no"] = "No"; }
  else if (q.type === "true_false") { labels["true"] = "True"; labels["false"] = "False"; }
  else (q.options || []).forEach((o) => (labels[o.code] = o.label));
  return { codes: Object.keys(labels), labels };
}

// chi-square CDF -> p value (survival). Uses regularized upper incomplete gamma.
function chiSqPValue(x: number, k: number): number {
  if (x <= 0 || k <= 0) return 1;
  // upper incomplete gamma Q(k/2, x/2) via series/continued fraction
  const a = k / 2, xx = x / 2;
  return gammaQ(a, xx);
}
function gammaLn(z: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - gammaLn(1 - z);
  z -= 1; let x = c[0]; const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function gammaP(a: number, x: number): number { // lower regularized via series
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 0; n < 200; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
  return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
}
function gammaQ(a: number, x: number): number { // upper regularized
  if (x < a + 1) return 1 - gammaP(a, x);
  // continued fraction
  let b = x + 1 - a, c = 1e300, dd = 1 / b, h = dd;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2; dd = an * dd + b; if (Math.abs(dd) < 1e-300) dd = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    dd = 1 / dd; const del = dd * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
}

export function crossTab(rowQ: Question, colQ: Question, subs: any[]): CrossTab {
  const r = optionLabels(rowQ), c = optionLabels(colQ);
  const rowCodes = r.codes, colCodes = c.codes;
  const counts = rowCodes.map(() => colCodes.map(() => 0));
  let grand = 0;
  subs.forEach((s) => {
    const rv = s?.payload?.[rowQ.code], cv = s?.payload?.[colQ.code];
    const rvs = Array.isArray(rv) ? rv : [rv], cvs = Array.isArray(cv) ? cv : [cv];
    rvs.forEach((rx) => cvs.forEach((cx) => {
      const ri = rowCodes.indexOf(String(rx)), ci = colCodes.indexOf(String(cx));
      if (ri >= 0 && ci >= 0) { counts[ri][ci]++; grand++; }
    }));
  });
  const rowTotals = counts.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = colCodes.map((_, ci) => counts.reduce((a, row) => a + row[ci], 0));
  const colPct = counts.map((row) => row.map((v, ci) => colTotals[ci] ? (100 * v) / colTotals[ci] : 0));
  const rowPct = counts.map((row, ri) => row.map((v) => rowTotals[ri] ? (100 * v) / rowTotals[ri] : 0));

  // chi-square
  let chi2 = 0; let cellsOk = true;
  for (let i = 0; i < rowCodes.length; i++) for (let j = 0; j < colCodes.length; j++) {
    const exp = grand ? (rowTotals[i] * colTotals[j]) / grand : 0;
    if (exp > 0) chi2 += (counts[i][j] - exp) ** 2 / exp;
    if (exp < 5) cellsOk = false;
  }
  const df = (rowCodes.length - 1) * (colCodes.length - 1);
  const pValue = df > 0 ? chiSqPValue(chi2, df) : 1;
  const minDim = Math.min(rowCodes.length, colCodes.length) - 1;
  const cramersV = grand > 0 && minDim > 0 ? Math.sqrt(chi2 / (grand * minDim)) : 0;

  return {
    rowLabels: rowCodes.map((k) => r.labels[k]), colLabels: colCodes.map((k) => c.labels[k]),
    rowCodes, colCodes, counts, rowTotals, colTotals, grand, colPct, rowPct,
    chi2, df, pValue, cramersV, valid: grand > 0 && df > 0,
    note: !cellsOk ? "Some expected counts are below 5; chi-square may be unreliable." : undefined,
  };
}

export function pStars(p: number): string {
  if (p < 0.001) return "p < 0.001 ***"; if (p < 0.01) return "p < 0.01 **"; if (p < 0.05) return "p < 0.05 *";
  return "not significant (p = " + p.toFixed(3) + ")";
}

// Pearson correlation between two numeric questions
export function correlation(aCode: string, bCode: string, subs: any[]): { r: number; n: number } {
  const pairs = subs.map((s) => [Number(s?.payload?.[aCode]), Number(s?.payload?.[bCode])]).filter(([a, b]) => !isNaN(a) && !isNaN(b));
  const n = pairs.length; if (n < 2) return { r: 0, n };
  const ma = pairs.reduce((s, p) => s + p[0], 0) / n, mb = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, da = 0, db = 0;
  pairs.forEach(([a, b]) => { num += (a - ma) * (b - mb); da += (a - ma) ** 2; db += (b - mb) ** 2; });
  const den = Math.sqrt(da * db);
  return { r: den ? num / den : 0, n };
}
