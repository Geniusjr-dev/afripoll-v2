// The six fixed core research modules. Single source of truth (see ARCHITECTURE.md section 2).
// project_type is the value stored in the DB; slug is the URL segment; icon is an ASCII badge.

export type ModuleType =
  | "market_research"
  | "election_observation"
  | "pre_election"
  | "post_election"
  | "constituency_scorecard"
  | "mp_assessment";

export interface ModuleDef {
  type: ModuleType;
  slug: string;
  label: string;
  short: string;   // ASCII badge, no emoji (house rule)
  colour: string;  // brand-aligned accent
  blurb: string;
}

export const MODULES: ModuleDef[] = [
  { type: "market_research",       slug: "market-research",         label: "Market Research",          short: "MR", colour: "#8DC63F", blurb: "Opinion polls, party and candidate preference, issue salience." },
  { type: "election_observation",  slug: "election-observation",    label: "Election Observation",     short: "EO", colour: "#2E86C1", blurb: "Polling-day observation: opening, materials, security, counting." },
  { type: "pre_election",          slug: "pre-election",            label: "Pre-Election Surveys",     short: "PR", colour: "#E0A32E", blurb: "Campaign monitoring, voter education, violence and misinformation." },
  { type: "post_election",         slug: "post-election",           label: "Post-Election Surveys",    short: "PO", colour: "#6B46C1", blurb: "Satisfaction, acceptance of results, credibility and disputes." },
  { type: "constituency_scorecard",slug: "constituency-scorecards", label: "Constituency Scorecards",  short: "CS", colour: "#0E7C7B", blurb: "Rate local services: roads, schools, health, water, power, jobs." },
  { type: "mp_assessment",         slug: "mp-performance",          label: "MP Performance Assessment",short: "MP", colour: "#0B4DA2", blurb: "Accessibility, responsiveness, leadership, accountability, projects." },
];

export const bySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
export const byType = (t: string) => MODULES.find((m) => m.type === t);
export const labelForType = (t: string) => byType(t)?.label || "Study";

// Module navigation pattern (identical across all six) - ARCHITECTURE.md section 2.
export const MODULE_NAV = [
  { key: "home",      label: "Home",      seg: "" },
  { key: "studies",   label: "Studies",   seg: "studies" },
  { key: "dashboard", label: "Dashboard", seg: "dashboard" },
  { key: "builder",   label: "Builder",   seg: "builder" },
  { key: "collect",   label: "Collect",   seg: "collect" },
  { key: "reports",   label: "Reports",   seg: "reports" },
  { key: "team",      label: "Team",      seg: "team" },
  { key: "settings",  label: "Settings",  seg: "settings" },
];

// Organisation workspace navigation - never includes Builder or Collect (invariant #1).
export const ORG_NAV = [
  { key: "home",      label: "Organisation Home", seg: "" },
  { key: "dashboard", label: "Executive Dashboard", seg: "organisation/dashboard" },
  { key: "analytics", label: "Cross-Module Analytics", seg: "organisation/analytics" },
  { key: "reports",   label: "Organisation Reports", seg: "organisation/reports" },
  { key: "team",      label: "Users & Teams", seg: "organisation/team" },
  { key: "settings",  label: "Settings", seg: "organisation/settings" },
  { key: "audit",     label: "Audit Logs", seg: "organisation/audit" },
];
