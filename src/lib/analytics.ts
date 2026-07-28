// Pure analytics helpers for study-scoped dashboards. No React, no DOM.

export interface Question { code: string; label: string; type: string; options?: { code: string; label: string }[]; config?: any; }
export interface ChoiceRow { code: string; label: string; count: number; pct: number; }
export interface ChoiceSummary { kind: "choice"; n: number; rows: ChoiceRow[]; }
export interface NumSummary { kind: "num"; n: number; mean: number; median: number; mode: number | null; sd: number; min: number; max: number; dist: Record<string, number>; }
export interface TextSummary { kind: "text"; n: number; samples: string[]; }
export type Summary = ChoiceSummary | NumSummary | TextSummary;

const CHOICE_TYPES = ["single_choice", "multiple_choice", "dropdown", "likert", "yes_no"];
const NUM_TYPES = ["number", "rating"];

export function summarise(q: Question, subs: any[]): Summary {
  const vals = subs.map((s) => s?.payload?.[q.code]).filter((v) => v !== undefined && v !== null && v !== "");

  if (CHOICE_TYPES.includes(q.type)) {
    let labels: Record<string, string> = {};
    if (q.type === "yes_no") labels = { yes: "Yes", no: "No" };
    else (q.options || []).forEach((o) => (labels[o.code] = o.label));
    const counts: Record<string, number> = {};
    Object.keys(labels).forEach((k) => (counts[k] = 0));
    let n = 0;
    vals.forEach((v) => {
      const arr = Array.isArray(v) ? v : [v];
      arr.forEach((x) => { const k = String(x); if (k in counts) { counts[k]++; n++; } });
    });
    const rows: ChoiceRow[] = Object.keys(labels).map((k) => ({
      code: k, label: labels[k], count: counts[k], pct: n ? (100 * counts[k]) / n : 0,
    }));
    return { kind: "choice", n, rows };
  }

  if (NUM_TYPES.includes(q.type)) {
    const nums = vals.map(Number).filter((x) => !isNaN(x));
    const n = nums.length;
    const mean = n ? nums.reduce((a, b) => a + b, 0) / n : 0;
    const dist: Record<string, number> = {};
    nums.forEach((x) => (dist[x] = (dist[x] || 0) + 1));
    let median = 0, sd = 0, mode: number | null = null;
    if (n) {
      const a = [...nums].sort((x, y) => x - y), m = Math.floor(a.length / 2);
      median = a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      const varc = nums.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
      sd = Math.sqrt(varc);
      let best = -1; Object.keys(dist).forEach((k) => { if (dist[k] > best) { best = dist[k]; mode = Number(k); } });
    }
    return { kind: "num", n, mean, median, mode, sd, min: n ? Math.min(...nums) : 0, max: n ? Math.max(...nums) : 0, dist };
  }

  return { kind: "text", n: vals.length, samples: vals.slice(0, 5).map(String) };
}

export const CHART_COLORS = ["#0B4DA2", "#8DC63F", "#2E86C1", "#E0A32E", "#6B46C1", "#0E7C7B", "#B05630", "#5A6B7B"];

// Horizontal bar chart SVG for a choice summary.
export function hbarSVG(rows: ChoiceRow[]): string {
  const W = 640, rowH = 40, padT = 6, labelW = 150, pad = padT;
  const h = rows.length * rowH + pad + 4;
  const trackX = labelW + 8, trackW = W - labelW - 90;
  const max = Math.max(1, ...rows.map((r) => r.count));
  let out = "";
  rows.forEach((r, i) => {
    const y = pad + i * rowH;
    const w = (trackW * r.count) / max;
    out += `<text x="0" y="${y + 24}" font-family="Inter,sans-serif" font-size="13" fill="#132A43">${esc(r.label).slice(0, 22)}</text>`;
    out += `<rect x="${trackX}" y="${y + 12}" width="${trackW}" height="16" rx="8" fill="#EEF2F6"/>`;
    out += `<rect x="${trackX}" y="${y + 12}" width="${w.toFixed(1)}" height="16" rx="8" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`;
    out += `<text x="${W}" y="${y + 24}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="12" fill="#5A6B7B">${r.count} (${r.pct.toFixed(1)}%)</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMid meet">${out}</svg>`;
}

// Vertical column chart for numeric distributions or choice.
export function columnSVG(labels: string[], counts: number[]): string {
  const W = 640, H = 260, padB = 34, padT = 20, padL = 10;
  const n = labels.length || 1;
  const plotW = W - padL - 10, plotH = H - padB - padT;
  const bw = Math.min(70, (plotW / n) * 0.62), gap = plotW / n;
  const max = Math.max(1, ...counts);
  let out = `<line x1="${padL}" y1="${padT + plotH}" x2="${W - 10}" y2="${padT + plotH}" stroke="#E2E8F0"/>`;
  labels.forEach((lb, i) => {
    const bh = (plotH * counts[i]) / max;
    const x = padL + i * gap + (gap - bw) / 2;
    const y = padT + plotH - bh;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`;
    out += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" fill="#5A6B7B">${counts[i]}</text>`;
    out += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" fill="#132A43">${esc(lb).slice(0, 10)}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${out}</svg>`;
}

// Donut chart for a choice summary.
export function donutSVG(rows: ChoiceRow[]): string {
  const total = rows.reduce((a, b) => a + b.count, 0) || 1;
  const cx = 90, cy = 90, r = 66, sw = 26, C = 2 * Math.PI * r;
  let off = 0;
  let segs = "";
  rows.forEach((row, i) => {
    if (row.count === 0) return;
    const frac = row.count / total, len = C * frac;
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len;
  });
  const legend = rows.map((row, i) =>
    `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin:3px 0;"><span style="width:11px;height:11px;border-radius:3px;background:${CHART_COLORS[i % CHART_COLORS.length]};display:inline-block;"></span><span style="flex:1;">${esc(row.label)}</span><b style="font-family:'IBM Plex Mono',monospace;">${row.pct.toFixed(1)}%</b></div>`
  ).join("");
  return `<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;">
    <svg width="180" height="180" viewBox="0 0 180 180">${segs}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="800" font-size="26" fill="#0B2647">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="#94A3B4">RESPONSES</text></svg>
    <div style="flex:1;min-width:160px;">${legend}</div></div>`;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- additional chart builders for the Reports module ----

export function pieSVG(rows: ChoiceRow[]): string {
  const total = rows.reduce((a, b) => a + b.count, 0) || 1;
  const cx = 90, cy = 90, r = 82;
  let a0 = -Math.PI / 2, segs = "";
  rows.forEach((row, i) => {
    if (row.count === 0) return;
    const frac = row.count / total, a1 = a0 + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    segs += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`;
    a0 = a1;
  });
  const legend = rows.map((row, i) => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;margin:3px 0;"><span style="width:11px;height:11px;border-radius:3px;background:${CHART_COLORS[i % CHART_COLORS.length]};display:inline-block;"></span><span style="flex:1;">${esc(row.label)}</span><b style="font-family:'IBM Plex Mono',monospace;">${row.pct.toFixed(1)}%</b></div>`).join("");
  return `<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;"><svg width="180" height="180" viewBox="0 0 180 180">${segs}</svg><div style="flex:1;min-width:160px;">${legend}</div></div>`;
}

export function lineSVG(labels: string[], counts: number[]): string {
  const W = 640, H = 240, padL = 40, padB = 34, padT = 16;
  const plotW = W - padL - 12, plotH = H - padB - padT;
  const n = labels.length || 1, max = Math.max(1, ...counts);
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH - (plotH * v) / max;
  let pts = counts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  let dots = counts.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="#0B4DA2"/>`).join("");
  let xlabels = labels.map((lb, i) => `<text x="${x(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#132A43">${esc(lb).slice(0, 8)}</text>`).join("");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><line x1="${padL}" y1="${padT + plotH}" x2="${W - 12}" y2="${padT + plotH}" stroke="#E2E8F0"/><polyline points="${pts}" fill="none" stroke="#0B4DA2" stroke-width="2.5"/>${dots}${xlabels}</svg>`;
}

// Proper histogram: continuous data grouped into adjacent bins (bars touch, no gaps).
// For discrete data with few distinct integer values, it bins by each value so labels stay clean.
export function histogramSVG(values: number[], bins = 0): string {
  if (!values.length) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const distinct = Array.from(new Set(values)).sort((a, b) => a - b);
  const allInt = values.every((v) => Number.isInteger(v));

  // Decide binning: if few distinct integer values, one bin per value; else Sturges/sqrt rule.
  let edges: number[] = [];
  if (allInt && distinct.length <= 12) {
    // one bin per integer value across the observed range
    for (let v = min; v <= max + 1; v++) edges.push(v - 0.5);
  } else {
    const k = bins > 0 ? bins : Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const w = (max - min) / k || 1;
    for (let i = 0; i <= k; i++) edges.push(min + i * w);
  }
  const nb = edges.length - 1;
  const counts = new Array(nb).fill(0);
  values.forEach((v) => { let b = 0; while (b < nb - 1 && v >= edges[b + 1]) b++; counts[b]++; });

  const W = 660, H = 280, padL = 40, padB = 40, padT = 20;
  const plotW = W - padL - 14, plotH = H - padB - padT;
  const maxC = Math.max(1, ...counts);
  const bw = plotW / nb;
  let bars = "", labels = "", yticks = "";
  // y gridlines
  const yStep = niceStep(maxC);
  for (let yv = 0; yv <= maxC; yv += yStep) {
    const y = padT + plotH - (plotH * yv) / maxC;
    yticks += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - 14}" y2="${y.toFixed(1)}" stroke="#EEF2F6"/><text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#8A99A8" font-family="IBM Plex Mono,monospace">${yv}</text>`;
  }
  counts.forEach((c, i) => {
    const bh = (plotH * c) / maxC;
    const x = padL + i * bw, y = padT + plotH - bh;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" fill="#0B4DA2" stroke="#ffffff" stroke-width="1"/>`;
    if (c > 0) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="10" fill="#5A6B7B" font-family="IBM Plex Mono,monospace">${c}</text>`;
  });
  // x-axis edge labels (unique, at bin boundaries)
  const showEvery = Math.ceil(edges.length / 10);
  edges.forEach((e, i) => {
    if (i % showEvery !== 0 && i !== edges.length - 1) return;
    const x = padL + i * bw;
    const lbl = allInt && distinct.length <= 12 ? (e + 0.5).toFixed(0) : e.toFixed(edges[edges.length - 1] - edges[0] > 10 ? 0 : 1);
    labels += `<text x="${x.toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="9.5" fill="#132A43" font-family="Inter,sans-serif">${lbl}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${yticks}<line x1="${padL}" y1="${padT + plotH}" x2="${W - 14}" y2="${padT + plotH}" stroke="#CBD5E1"/>${bars}${labels}</svg>`;
}

function niceStep(max: number): number {
  if (max <= 5) return 1;
  if (max <= 10) return 2;
  if (max <= 25) return 5;
  if (max <= 50) return 10;
  return Math.ceil(max / 5 / 10) * 10;
}

export function scatterSVG(pairs: [number, number][], xl = "X", yl = "Y"): string {
  if (!pairs.length) return "";
  const W = 460, H = 300, pad = 40;
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const sx = (v: number) => pad + ((W - pad - 12) * (v - xmin)) / (xmax - xmin || 1);
  const sy = (v: number) => (H - pad) - ((H - pad - 12) * (v - ymin)) / (ymax - ymin || 1);
  const dots = pairs.map(([a, b]) => `<circle cx="${sx(a).toFixed(1)}" cy="${sy(b).toFixed(1)}" r="4" fill="#0B4DA2" opacity="0.6"/>`).join("");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><line x1="${pad}" y1="${H - pad}" x2="${W - 12}" y2="${H - pad}" stroke="#E2E8F0"/><line x1="${pad}" y1="12" x2="${pad}" y2="${H - pad}" stroke="#E2E8F0"/>${dots}<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#5A6B7B" font-family="Inter,sans-serif">${esc(xl)}</text></svg>`;
}

// ================= Additional 2D chart builders (Step 3) =================
// All pure-SVG, same conventions: return an SVG string, use CHART_COLORS + esc().

// Grouped bar: series of groups, each with multiple bars. data: {groups:[labels], series:[{name,values[]}]}
export function groupedBarSVG(groups: string[], series: { name: string; values: number[] }[]): string {
  const W = 660, H = 300, padL = 40, padB = 46, padT = 16;
  const plotW = W - padL - 12, plotH = H - padB - padT;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const gCount = groups.length || 1, sCount = series.length || 1;
  const groupW = plotW / gCount, barW = Math.min(38, (groupW - 10) / sCount);
  let bars = "", labels = "";
  groups.forEach((g, gi) => {
    const gx = padL + gi * groupW;
    series.forEach((s, si) => {
      const v = s.values[gi] || 0, bh = (plotH * v) / max;
      const x = gx + (groupW - barW * sCount) / 2 + si * barW;
      const y = padT + plotH - bh;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 3).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${CHART_COLORS[si % CHART_COLORS.length]}"/>`;
    });
    labels += `<text x="${(gx + groupW / 2).toFixed(1)}" y="${H - 26}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#132A43">${esc(g).slice(0, 12)}</text>`;
  });
  const legend = series.map((s, i) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11.5px;"><span style="width:11px;height:11px;border-radius:3px;background:${CHART_COLORS[i % CHART_COLORS.length]};display:inline-block;"></span>${esc(s.name)}</span>`).join("");
  return `<div><svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><line x1="${padL}" y1="${padT + plotH}" x2="${W - 12}" y2="${padT + plotH}" stroke="#E2E8F0"/>${bars}${labels}</svg><div style="margin-top:6px;">${legend}</div></div>`;
}

// Stacked bar: same shape as grouped but stacked per group
export function stackedBarSVG(groups: string[], series: { name: string; values: number[] }[]): string {
  const W = 660, H = 300, padL = 40, padB = 46, padT = 16;
  const plotW = W - padL - 12, plotH = H - padB - padT;
  const totals = groups.map((_, gi) => series.reduce((a, s) => a + (s.values[gi] || 0), 0));
  const max = Math.max(1, ...totals);
  const gCount = groups.length || 1, groupW = plotW / gCount, barW = Math.min(54, groupW - 14);
  let bars = "", labels = "";
  groups.forEach((g, gi) => {
    const gx = padL + gi * groupW + (groupW - barW) / 2;
    let acc = 0;
    series.forEach((s, si) => {
      const v = s.values[gi] || 0, bh = (plotH * v) / max;
      const y = padT + plotH - (plotH * (acc + v)) / max;
      bars += `<rect x="${gx.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${CHART_COLORS[si % CHART_COLORS.length]}"/>`;
      acc += v;
    });
    labels += `<text x="${(gx + barW / 2).toFixed(1)}" y="${H - 26}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#132A43">${esc(g).slice(0, 12)}</text>`;
  });
  const legend = series.map((s, i) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11.5px;"><span style="width:11px;height:11px;border-radius:3px;background:${CHART_COLORS[i % CHART_COLORS.length]};display:inline-block;"></span>${esc(s.name)}</span>`).join("");
  return `<div><svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><line x1="${padL}" y1="${padT + plotH}" x2="${W - 12}" y2="${padT + plotH}" stroke="#E2E8F0"/>${bars}${labels}</svg><div style="margin-top:6px;">${legend}</div></div>`;
}

// Area chart: like line but filled
export function areaSVG(labels: string[], counts: number[]): string {
  const W = 660, H = 260, padL = 40, padB = 34, padT = 16;
  const plotW = W - padL - 12, plotH = H - padB - padT;
  const n = labels.length || 1, max = Math.max(1, ...counts);
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH - (plotH * v) / max;
  const line = counts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${x(n - 1).toFixed(1)},${padT + plotH}`;
  const xlabels = labels.map((lb, i) => `<text x="${x(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#132A43">${esc(lb).slice(0, 8)}</text>`).join("");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0B4DA2" stop-opacity="0.35"/><stop offset="100%" stop-color="#0B4DA2" stop-opacity="0.03"/></linearGradient></defs><polygon points="${area}" fill="url(#ag)"/><polyline points="${line}" fill="none" stroke="#0B4DA2" stroke-width="2.5"/>${xlabels}</svg>`;
}

// Bubble chart: pairs with size. data: [{x,y,size,label}]
export function bubbleSVG(points: { x: number; y: number; size: number; label?: string }[]): string {
  if (!points.length) return "";
  const W = 520, H = 320, pad = 44;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), ss = points.map((p) => p.size);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys), smax = Math.max(...ss, 1);
  const sx = (v: number) => pad + ((W - pad - 14) * (v - xmin)) / (xmax - xmin || 1);
  const sy = (v: number) => (H - pad) - ((H - pad - 14) * (v - ymin)) / (ymax - ymin || 1);
  const bubbles = points.map((p, i) => { const r = 6 + 26 * Math.sqrt(p.size / smax); return `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${r.toFixed(1)}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" opacity="0.55"/>`; }).join("");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;"><line x1="${pad}" y1="${H - pad}" x2="${W - 14}" y2="${H - pad}" stroke="#E2E8F0"/><line x1="${pad}" y1="14" x2="${pad}" y2="${H - pad}" stroke="#E2E8F0"/>${bubbles}</svg>`;
}

// Box-and-whisker for numeric values
export function boxPlotSVG(values: number[]): string {
  if (values.length < 2) return "";
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => { const idx = (s.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return s[lo] + (s[hi] - s[lo]) * (idx - lo); };
  const min = s[0], max = s[s.length - 1], q1 = q(0.25), med = q(0.5), q3 = q(0.75);
  const W = 560, H = 150, padL = 30, padR = 20, y = 70, bh = 42;
  const scale = (v: number) => padL + ((W - padL - padR) * (v - min)) / (max - min || 1);
  const bx1 = scale(q1), bx3 = scale(q3), bmed = scale(med), bmin = scale(min), bmax = scale(max);
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">
    <line x1="${bmin}" y1="${y}" x2="${bx1}" y2="${y}" stroke="#5A6B7B"/><line x1="${bx3}" y1="${y}" x2="${bmax}" y2="${y}" stroke="#5A6B7B"/>
    <line x1="${bmin}" y1="${y - 12}" x2="${bmin}" y2="${y + 12}" stroke="#5A6B7B"/><line x1="${bmax}" y1="${y - 12}" x2="${bmax}" y2="${y + 12}" stroke="#5A6B7B"/>
    <rect x="${bx1}" y="${y - bh / 2}" width="${(bx3 - bx1).toFixed(1)}" height="${bh}" rx="4" fill="#0B4DA2" opacity="0.18" stroke="#0B4DA2"/>
    <line x1="${bmed}" y1="${y - bh / 2}" x2="${bmed}" y2="${y + bh / 2}" stroke="#0B4DA2" stroke-width="2.5"/>
    <text x="${bmin}" y="${y + 34}" text-anchor="middle" font-size="10" fill="#5A6B7B" font-family="IBM Plex Mono,monospace">${min}</text>
    <text x="${bmed}" y="${y - bh / 2 - 8}" text-anchor="middle" font-size="10" fill="#0B4DA2" font-family="IBM Plex Mono,monospace">med ${med.toFixed(1)}</text>
    <text x="${bmax}" y="${y + 34}" text-anchor="middle" font-size="10" fill="#5A6B7B" font-family="IBM Plex Mono,monospace">${max}</text>
  </svg>`;
}

// Radar chart: axes with one polygon. data: {axes:[labels], values:[nums]}
export function radarSVG(axes: string[], values: number[]): string {
  const W = 360, H = 360, cx = W / 2, cy = H / 2, r = 130;
  const n = axes.length || 1, max = Math.max(1, ...values);
  const pt = (i: number, frac: number) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + r * frac * Math.cos(a), cy + r * frac * Math.sin(a)]; };
  let rings = "";
  [0.25, 0.5, 0.75, 1].forEach((f) => { const p = axes.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(",")).join(" "); rings += `<polygon points="${p}" fill="none" stroke="#E2E8F0"/>`; });
  let spokes = "", labels = "";
  axes.forEach((ax, i) => { const [x, y] = pt(i, 1); spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E2E8F0"/>`;
    const [lx, ly] = pt(i, 1.16); labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="10" fill="#132A43" font-family="Inter,sans-serif">${esc(ax).slice(0, 12)}</text>`; });
  const poly = values.map((v, i) => pt(i, v / max).map((x) => x.toFixed(1)).join(",")).join(" ");
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${rings}${spokes}<polygon points="${poly}" fill="#0B4DA2" fill-opacity="0.25" stroke="#0B4DA2" stroke-width="2"/>${labels}</svg>`;
}

// Heat map: matrix of values. data: {rows:[labels], cols:[labels], matrix:[[..]]}
export function heatMapSVG(rowLabels: string[], colLabels: string[], matrix: number[][]): string {
  const cell = 44, padL = 90, padT = 30;
  const W = padL + colLabels.length * cell + 10, H = padT + rowLabels.length * cell + 10;
  const max = Math.max(1, ...matrix.flat());
  let cells = "", rlab = "", clab = "";
  matrix.forEach((row, ri) => { row.forEach((v, ci) => {
    const intensity = v / max; const x = padL + ci * cell, y = padT + ri * cell;
    cells += `<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="#0B4DA2" fill-opacity="${(0.08 + intensity * 0.85).toFixed(2)}"/><text x="${x + cell / 2 - 1}" y="${y + cell / 2 + 3}" text-anchor="middle" font-size="10" fill="${intensity > 0.5 ? "#fff" : "#132A43"}" font-family="IBM Plex Mono,monospace">${v}</text>`;
  }); rlab += `<text x="${padL - 8}" y="${padT + ri * cell + cell / 2 + 3}" text-anchor="end" font-size="10.5" fill="#132A43" font-family="Inter,sans-serif">${esc(rowLabels[ri]).slice(0, 14)}</text>`; });
  colLabels.forEach((c, ci) => { clab += `<text x="${padL + ci * cell + cell / 2 - 1}" y="${padT - 10}" text-anchor="middle" font-size="10.5" fill="#132A43" font-family="Inter,sans-serif">${esc(c).slice(0, 10)}</text>`; });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${cells}${rlab}${clab}</svg>`;
}

// Treemap: nested rectangles sized by value (simple squarified-ish row layout)
export function treemapSVG(rows: ChoiceRow[]): string {
  const W = 620, H = 320;
  const total = rows.reduce((a, b) => a + b.count, 0) || 1;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  let y = 0, out = "", i = 0;
  // simple row-based layout: each row height proportional to its share sum, boxes split horizontally
  // group into rows of up to 3
  const perRow = 3;
  for (let r = 0; r < sorted.length; r += perRow) {
    const group = sorted.slice(r, r + perRow);
    const groupSum = group.reduce((a, b) => a + b.count, 0) || 1;
    const rowH = (H * groupSum) / total;
    let x = 0;
    group.forEach((row) => {
      const w = (W * row.count) / groupSum;
      const c = CHART_COLORS[i % CHART_COLORS.length];
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w - 3).toFixed(1)}" height="${(rowH - 3).toFixed(1)}" rx="4" fill="${c}"/>`;
      if (w > 60 && rowH > 34) out += `<text x="${(x + 8).toFixed(1)}" y="${(y + 20).toFixed(1)}" font-size="11" fill="#fff" font-family="Inter,sans-serif">${esc(row.label).slice(0, 16)}</text><text x="${(x + 8).toFixed(1)}" y="${(y + 36).toFixed(1)}" font-size="11" fill="#fff" font-family="IBM Plex Mono,monospace" opacity="0.85">${row.count}</text>`;
      x += w; i++;
    });
    y += rowH;
  }
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${out}</svg>`;
}

// Funnel chart: descending stages
export function funnelSVG(rows: ChoiceRow[]): string {
  const W = 560, H = 300, cx = W / 2;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  const stageH = H / (sorted.length || 1);
  let out = "";
  sorted.forEach((row, i) => {
    const wTop = (W * 0.9 * row.count) / max;
    const next = sorted[i + 1];
    const wBot = next ? (W * 0.9 * next.count) / max : wTop * 0.6;
    const yTop = i * stageH, yBot = (i + 1) * stageH - 8;
    const c = CHART_COLORS[i % CHART_COLORS.length];
    out += `<polygon points="${(cx - wTop / 2).toFixed(1)},${yTop.toFixed(1)} ${(cx + wTop / 2).toFixed(1)},${yTop.toFixed(1)} ${(cx + wBot / 2).toFixed(1)},${yBot.toFixed(1)} ${(cx - wBot / 2).toFixed(1)},${yBot.toFixed(1)}" fill="${c}" opacity="0.9"/>`;
    out += `<text x="${cx}" y="${(yTop + stageH / 2).toFixed(1)}" text-anchor="middle" font-size="12" fill="#fff" font-family="Inter,sans-serif">${esc(row.label).slice(0, 20)} (${row.count})</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${out}</svg>`;
}

// Sankey (simple two-column flow). data: {left:[{label,value}], right:[{label,value}], flows:[{from,to,value}]}
export function sankeySVG(left: { label: string; value: number }[], right: { label: string; value: number }[], flows: { from: number; to: number; value: number }[]): string {
  const W = 640, H = 340, colW = 18, padY = 20;
  const leftTotal = left.reduce((a, b) => a + b.value, 0) || 1;
  const rightTotal = right.reduce((a, b) => a + b.value, 0) || 1;
  const scaleL = (H - padY * 2) / leftTotal, scaleR = (H - padY * 2) / rightTotal;
  // node positions
  let ly = padY; const lNodes = left.map((n, i) => { const h = n.value * scaleL; const o = { y: ly, h, cursorY: ly }; ly += h + 6; return o; });
  let ry = padY; const rNodes = right.map((n, i) => { const h = n.value * scaleR; const o = { y: ry, h, cursorY: ry }; ry += h + 6; return o; });
  let paths = "";
  flows.forEach((f, i) => {
    const L = lNodes[f.from], R = rNodes[f.to]; if (!L || !R) return;
    const fh = f.value * scaleL, rh = f.value * scaleR;
    const x0 = colW, x1 = W - colW;
    const y0 = L.cursorY, y1 = R.cursorY; L.cursorY += fh; R.cursorY += rh;
    const mx = (x0 + x1) / 2;
    paths += `<path d="M${x0},${y0.toFixed(1)} C${mx},${y0.toFixed(1)} ${mx},${y1.toFixed(1)} ${x1},${y1.toFixed(1)} L${x1},${(y1 + rh).toFixed(1)} C${mx},${(y1 + rh).toFixed(1)} ${mx},${(y0 + fh).toFixed(1)} ${x0},${(y0 + fh).toFixed(1)} Z" fill="${CHART_COLORS[i % CHART_COLORS.length]}" opacity="0.32"/>`;
  });
  let nodes = "", labels = "";
  lNodes.forEach((n, i) => { nodes += `<rect x="0" y="${n.y.toFixed(1)}" width="${colW}" height="${n.h.toFixed(1)}" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`; labels += `<text x="${colW + 6}" y="${(n.y + n.h / 2 + 3).toFixed(1)}" font-size="10.5" fill="#132A43" font-family="Inter,sans-serif">${esc(left[i].label).slice(0, 16)}</text>`; });
  rNodes.forEach((n, i) => { nodes += `<rect x="${W - colW}" y="${n.y.toFixed(1)}" width="${colW}" height="${n.h.toFixed(1)}" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/>`; labels += `<text x="${W - colW - 6}" y="${(n.y + n.h / 2 + 3).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#132A43" font-family="Inter,sans-serif">${esc(right[i].label).slice(0, 16)}</text>`; });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;">${paths}${nodes}${labels}</svg>`;
}
