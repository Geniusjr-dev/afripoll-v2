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
  { key: "enumerator", name: "Enumerator Performance Report", blurb: "Fieldworker productivity and quality.",
    sections: ["cover", "exec", "kpi", "geographic", "appendix"] },
  { key: "constituency", name: "Constituency Report", blurb: "Findings for a single constituency.",
    sections: ["cover", "exec", "kpi", "charts", "geographic", "recommendations"] },
  { key: "mp", name: "MP Report", blurb: "Member of Parliament assessment summary.",
    sections: ["cover", "exec", "charts", "crosstab", "insights", "recommendations"] },
  { key: "observation", name: "Election Observation Report", blurb: "Polling-day observation summary.",
    sections: ["cover", "exec", "kpi", "charts", "geographic", "appendix"] },
  { key: "incident", name: "Incident Report", blurb: "Incident logging and analysis.",
    sections: ["cover", "exec", "charts", "geographic", "appendix"] },
  { key: "infographic", name: "Infographic Report", blurb: "Visual one-page snapshot.",
    sections: ["cover", "kpi", "charts", "insights"] },
  { key: "full", name: "Full Report", blurb: "Everything AfriPoll can produce.",
    sections: ALL },
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  cover: "Cover page", exec: "Executive summary", methodology: "Methodology", kpi: "Dashboard summary",
  charts: "Charts & findings", crosstab: "Cross-tabulation", statistics: "Statistical analysis",
  geographic: "Geographic analysis", insights: "AI insights", recommendations: "Recommendations", appendix: "Appendix",
};
