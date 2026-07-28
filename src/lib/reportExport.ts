"use client";
// Export engine for AfriPoll reports. Produces CSV, Excel, Word, PowerPoint and PDF.
import { summarise, Question } from "./analytics";

export interface ExportData {
  studyName: string;
  moduleName: string;
  reportType: string;
  version: string;
  confidentiality: string;
  preparedBy: string;
  date: string;
  questions: Question[];
  subs: any[];
  stats: { n: number; regions: string[]; consts: string[]; flagged: number; dq: number; first?: string; last?: string; enums: number; avgDur: number; gpsRate: number };
  insights: string[];
  recommendations: string[];
  regionRows: { name: string; count: number; pct: number }[];
}

function ts() { return new Date().toISOString().slice(0, 10); }
function safe(s: string) { return (s || "report").replace(/[^a-z0-9]+/gi, "_").slice(0, 50); }

async function download(blob: Blob, filename: string) {
  const mod: any = await import("file-saver");
  const saveAs = mod.saveAs || mod.default || mod;
  saveAs(blob, filename);
}

// ---------- CSV ----------
export async function exportCSV(d: ExportData) {
  const lines: string[] = [];
  const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  // one block per question with frequencies
  d.questions.forEach((q, i) => {
    const s = summarise(q, d.subs);
    lines.push(esc(`${i + 1}. ${q.label}`));
    if (s.kind === "choice") { lines.push("Option,Count,Percent"); s.rows.forEach((r) => lines.push([esc(r.label), r.count, r.pct.toFixed(1) + "%"].join(","))); }
    else if (s.kind === "num") { lines.push("Statistic,Value"); lines.push(`Mean,${s.mean.toFixed(2)}`); lines.push(`Median,${s.median.toFixed(2)}`); lines.push(`Std dev,${s.sd.toFixed(2)}`); lines.push(`Min,${s.min}`); lines.push(`Max,${s.max}`); lines.push(`n,${s.n}`); }
    else { lines.push("Responses," + s.n); }
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  await download(blob, `${safe(d.studyName)}_data_${ts()}.csv`);
}

// ---------- Excel ----------
export async function exportExcel(d: ExportData) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = [
    ["AfriPoll Analytics - Findings Data"],
    ["Study", d.studyName], ["Module", d.moduleName], ["Report type", d.reportType],
    ["Prepared by", d.preparedBy], ["Date", d.date], ["Version", d.version], ["Confidentiality", d.confidentiality],
    [], ["Responses", d.stats.n], ["Regions", d.stats.regions.length], ["Constituencies", d.stats.consts.length],
    ["Data quality %", d.stats.dq], ["Flagged", d.stats.flagged], ["Enumerators", d.stats.enums],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  // One sheet: all questions frequencies
  const freq: any[][] = [["Question", "Option / Statistic", "Count / Value", "Percent"]];
  d.questions.forEach((q, i) => {
    const s = summarise(q, d.subs);
    if (s.kind === "choice") s.rows.forEach((r) => freq.push([`${i + 1}. ${q.label}`, r.label, r.count, r.pct.toFixed(1) + "%"]));
    else if (s.kind === "num") { freq.push([`${i + 1}. ${q.label}`, "Mean", s.mean.toFixed(2), ""]); freq.push(["", "Median", s.median.toFixed(2), ""]); freq.push(["", "Std dev", s.sd.toFixed(2), ""]); freq.push(["", "Min", s.min, ""]); freq.push(["", "Max", s.max, ""]); freq.push(["", "n", s.n, ""]); }
    else freq.push([`${i + 1}. ${q.label}`, "Text responses", s.n, ""]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(freq), "Frequencies");

  // Raw responses sheet: one row per submission, columns = question codes
  const codes = d.questions.map((q) => q.code);
  const header = ["response_id", "captured_at", "region", ...codes];
  const raw: any[][] = [header];
  d.subs.forEach((sub, i) => {
    const row: any[] = [i + 1, (sub.captured_at || "").slice(0, 19).replace("T", " "), ""];
    codes.forEach((c) => { const v = sub?.payload?.[c]; row.push(Array.isArray(v) ? v.join("; ") : (v ?? "")); });
    raw.push(row);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), "Raw responses");

  // Geographic sheet
  const geo: any[][] = [["Region", "Responses", "Percent"], ...d.regionRows.map((r) => [r.name, r.count, r.pct.toFixed(1) + "%"])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(geo), "Geographic");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  await download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safe(d.studyName)}_data_${ts()}.xlsx`);
}

// ---------- Word ----------
export async function exportWord(d: ExportData) {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = docx;

  const kids: any[] = [];
  const P = (text: string, opts: any = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], ...opts.para });
  // cover
  kids.push(new Paragraph({ text: "AfriPoll Analytics", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  kids.push(new Paragraph({ text: d.moduleName, alignment: AlignmentType.CENTER }));
  kids.push(new Paragraph({ text: d.studyName, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
  kids.push(new Paragraph({ text: d.reportType, alignment: AlignmentType.CENTER }));
  kids.push(P(`Date: ${d.date}   |   Prepared by: ${d.preparedBy}   |   Version: ${d.version}   |   ${d.confidentiality}`, { para: { alignment: AlignmentType.CENTER } }));
  kids.push(new Paragraph({ text: "" }));

  // executive summary
  kids.push(new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_2 }));
  kids.push(P(`This report summarises ${d.stats.n} responses for ${d.studyName}${d.stats.first ? ` collected between ${d.stats.first} and ${d.stats.last}` : ""}${d.stats.regions.length ? `, covering ${d.stats.regions.join(", ")}` : ""}. The screening pass rate was ${d.stats.dq}%${d.stats.flagged ? `, with ${d.stats.flagged} flagged for review.` : "."}`));
  kids.push(new Paragraph({ text: "Key findings", heading: HeadingLevel.HEADING_3 }));
  d.insights.forEach((i) => kids.push(new Paragraph({ text: i, bullet: { level: 0 } })));

  // findings tables
  kids.push(new Paragraph({ text: "Findings", heading: HeadingLevel.HEADING_2 }));
  d.questions.forEach((q, i) => {
    const s = summarise(q, d.subs);
    kids.push(new Paragraph({ text: `${i + 1}. ${q.label}`, heading: HeadingLevel.HEADING_3 }));
    if (s.kind === "choice" && s.n > 0) {
      const rows = [new TableRow({ children: ["Option", "Count", "%"].map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) })];
      s.rows.forEach((r) => rows.push(new TableRow({ children: [r.label, String(r.count), r.pct.toFixed(1) + "%"].map((c) => new TableCell({ children: [new Paragraph(c)] })) })));
      kids.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    } else if (s.kind === "num" && s.n > 0) {
      kids.push(P(`Mean ${s.mean.toFixed(2)}, median ${s.median.toFixed(2)}, std dev ${s.sd.toFixed(2)}, range ${s.min}-${s.max}, n=${s.n}.`));
    } else kids.push(P(`${s.n} response(s).`));
    kids.push(new Paragraph({ text: "" }));
  });

  // recommendations
  const recs = d.recommendations.filter((r) => r.trim());
  if (recs.length) {
    kids.push(new Paragraph({ text: "Recommendations", heading: HeadingLevel.HEADING_2 }));
    recs.forEach((r, i) => kids.push(new Paragraph({ text: `${i + 1}. ${r}` })));
  }

  const doc = new Document({ sections: [{ children: kids }] });
  const blob = await Packer.toBlob(doc);
  await download(blob, `${safe(d.studyName)}_${safe(d.reportType)}_${ts()}.docx`);
}

// ---------- PowerPoint ----------
export async function exportPPT(d: ExportData) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  const NAVY = "0B2647", BLUE = "0B4DA2", LIME = "8DC63F";

  // cover slide
  let s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addText("AfriPoll Analytics", { x: 0.5, y: 2.2, w: 12.3, h: 0.6, align: "center", color: LIME, fontSize: 20, bold: true });
  s.addText(d.studyName, { x: 0.5, y: 3.0, w: 12.3, h: 1.0, align: "center", color: "FFFFFF", fontSize: 40, bold: true });
  s.addText(d.reportType, { x: 0.5, y: 4.2, w: 12.3, h: 0.5, align: "center", color: "CFE0F4", fontSize: 20 });
  s.addText(`${d.date}  |  ${d.preparedBy}  |  v${d.version}  |  ${d.confidentiality}`, { x: 0.5, y: 5.2, w: 12.3, h: 0.4, align: "center", color: "9FB6D2", fontSize: 12 });

  // exec summary slide
  s = pptx.addSlide();
  s.addText("Executive Summary", { x: 0.5, y: 0.4, w: 12, h: 0.6, color: NAVY, fontSize: 26, bold: true });
  const kpis = [["Responses", d.stats.n], ["Regions", d.stats.regions.length], ["Constituencies", d.stats.consts.length], ["Data quality", d.stats.dq + "%"]];
  kpis.forEach(([k, v], i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 0.5 + i * 3.1, y: 1.3, w: 2.9, h: 1.3, fill: { color: "F0F3F7" }, line: { color: "E2E8F0" } });
    s.addText(String(v), { x: 0.5 + i * 3.1, y: 1.5, w: 2.9, h: 0.7, align: "center", color: BLUE, fontSize: 30, bold: true });
    s.addText(String(k), { x: 0.5 + i * 3.1, y: 2.2, w: 2.9, h: 0.3, align: "center", color: "5A6B7B", fontSize: 12 });
  });
  s.addText(d.insights.map((i) => "- " + i).join("\n"), { x: 0.5, y: 3.0, w: 12.3, h: 3.5, color: "0B2647", fontSize: 15, lineSpacingMultiple: 1.3 });

  // one slide per question
  d.questions.forEach((q, i) => {
    const sum = summarise(q, d.subs);
    const sl = pptx.addSlide();
    sl.addText(`${i + 1}. ${q.label}`, { x: 0.5, y: 0.4, w: 12.3, h: 0.8, color: NAVY, fontSize: 22, bold: true });
    if (sum.kind === "choice" && sum.n > 0) {
      const rows = [[{ text: "Option", options: { bold: true, fill: { color: "E7EFF9" } } }, { text: "Count", options: { bold: true, fill: { color: "E7EFF9" } } }, { text: "%", options: { bold: true, fill: { color: "E7EFF9" } } }]];
      sum.rows.forEach((r) => rows.push([{ text: r.label } as any, { text: String(r.count) } as any, { text: r.pct.toFixed(1) + "%" } as any]));
      sl.addTable(rows as any, { x: 0.5, y: 1.4, w: 6, fontSize: 14, border: { type: "solid", color: "E2E8F0", pt: 1 } });
      // simple bar chart
      const chartData = [{ name: q.label, labels: sum.rows.map((r) => r.label), values: sum.rows.map((r) => r.count) }];
      sl.addChart(pptx.ChartType.bar, chartData, { x: 6.8, y: 1.4, w: 6, h: 4.5, showLegend: false, chartColors: [BLUE] });
    } else if (sum.kind === "num" && sum.n > 0) {
      sl.addText(`Mean ${sum.mean.toFixed(2)}   Median ${sum.median.toFixed(2)}   Std dev ${sum.sd.toFixed(2)}   Min ${sum.min}   Max ${sum.max}   n=${sum.n}`, { x: 0.5, y: 1.6, w: 12, h: 0.5, color: "0B2647", fontSize: 16 });
    } else {
      sl.addText(`${sum.n} response(s).`, { x: 0.5, y: 1.6, w: 12, h: 0.5, color: "5A6B7B", fontSize: 16 });
    }
  });

  await pptx.writeFile({ fileName: `${safe(d.studyName)}_${safe(d.reportType)}_${ts()}.pptx` });
}

// ---------- PDF (print) ----------
export function exportPDF() { window.print(); }
