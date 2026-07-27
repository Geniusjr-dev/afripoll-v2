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
