// Report types and which sections each includes. Sections render in this order.
export type SectionKey =
  | "cover" | "exec" | "methodology" | "kpi" | "charts" | "crosstab"
  | "statistics" | "geographic" | "insights" | "recommendations" | "appendix";

export interface ReportType { key: string; name: string; blurb: string; sections: SectionKey[]; }

const ALL: SectionKey[] = ["cover", "exec", "methodology", "kpi", "charts", "crosstab", "statistics", "geographic", "insights", "recommendations", "appendix"];

// Canonical section order for rendering and the toggle UI.
export const ALL_SECTIONS: SectionKey[] = ["cover", "exec", "methodology", "kpi", "charts", "crosstab", "statistics", "geographic", "insights", "recommendations", "appendix"];

export const REPORT_TYPES: ReportType[] = [
  { key: "executive", name: "Executive Report", blurb: "Concise, decision-focused. For leadership and donors.",
    sections: ["cover", "exec", "kpi", "charts", "insights", "recommendations"] },
  { key: "technical", name: "Technical Report", blurb: "Full detail with methodology and appendix.",
    sections: ALL },
  { key: "statistical", name: "Statistical Report", blurb: "Cross-tabs, significance tests, descriptives.",
    sections: ["cover", "exec", "methodology", "charts", "crosstab", "statistics", "appendix"] },
  { key: "field_ops", name: "Field Operations Report", blurb: "Fieldwork, coverage and data quality.",
    sections: ["cover", "exec", "kpi", "geographic", "appendix"] },
  { key: "regional", name: "Regional Report", blurb: "Findings with geographic breakdown.",
    sections: ["cover", "exec", "kpi", "charts", "geographic", "recommendations"] },
  { key: "policy_brief", name: "Policy Brief", blurb: "Short, insight-led brief for policymakers.",
    sections: ["cover", "exec", "insights", "recommendations"] },
  { key: "full", name: "Full Report", blurb: "Everything AfriPoll can produce.",
    sections: ALL },
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  cover: "Cover page", exec: "Executive summary", methodology: "Methodology", kpi: "Dashboard summary",
  charts: "Charts & findings", crosstab: "Cross-tabulation", statistics: "Statistical analysis",
  geographic: "Geographic analysis", insights: "AI insights", recommendations: "Recommendations", appendix: "Appendix",
};
