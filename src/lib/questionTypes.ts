// Complete AfriPoll question type registry. `type` is the stored value; analytics.ts
// understands the core statistical types. Group drives the palette layout.
// `build` is the availability of the runtime behaviour:
//   "ready"    - fully works now (edit, save, analyse)
//   "collect"  - saves + previews; true capture handled by the Collect app (media/gps)
//   "engine"   - saves + previews; needs a runtime engine to fully function later

export type QGroup = "basic" | "choice" | "rating" | "advanced" | "election" | "media" | "gps";
export type QBuild = "ready" | "collect" | "engine";

export interface QTypeDef {
  type: string;
  label: string;
  hint: string;
  group: QGroup;
  build: QBuild;
  hasOptions: boolean;       // shows the option editor
  optionSource?: "manual" | "party" | "candidate" | "region" | "district" | "constituency" | "polling_station" | "fixed";
  fixedOptions?: { code: string; label: string }[];
  grid?: boolean;            // matrix/grid types (rows x columns)
  scale?: boolean;           // numeric scale config (min/max/step)
  badge: string;             // 2-char ASCII badge for the palette
}

const yn = [{ code: "yes", label: "Yes" }, { code: "no", label: "No" }];
const tf = [{ code: "true", label: "True" }, { code: "false", label: "False" }];
const satisfaction = [
  { code: "very_dissatisfied", label: "Very dissatisfied" },
  { code: "dissatisfied", label: "Dissatisfied" },
  { code: "neutral", label: "Neutral" },
  { code: "satisfied", label: "Satisfied" },
  { code: "very_satisfied", label: "Very satisfied" },
];
const agreement = [
  { code: "strongly_disagree", label: "Strongly disagree" },
  { code: "disagree", label: "Disagree" },
  { code: "neutral", label: "Neutral" },
  { code: "agree", label: "Agree" },
  { code: "strongly_agree", label: "Strongly agree" },
];

export const LIKERT_OPTIONS = agreement;

export const QTYPES: QTypeDef[] = [
  // BASIC
  { type: "short_text", label: "Short text", hint: "One line of text", group: "basic", build: "ready", hasOptions: false, badge: "Ab" },
  { type: "long_text", label: "Long text", hint: "Paragraph answer", group: "basic", build: "ready", hasOptions: false, badge: "Ap" },
  { type: "number", label: "Number", hint: "A numeric answer", group: "basic", build: "ready", hasOptions: false, badge: "12" },
  { type: "email", label: "Email", hint: "Email address, validated", group: "basic", build: "ready", hasOptions: false, badge: "@" },
  { type: "phone", label: "Phone number", hint: "Telephone number", group: "basic", build: "ready", hasOptions: false, badge: "Ph" },
  { type: "date", label: "Date", hint: "A calendar date", group: "basic", build: "ready", hasOptions: false, badge: "Dt" },
  { type: "time", label: "Time", hint: "A time of day", group: "basic", build: "ready", hasOptions: false, badge: "Tm" },

  // CHOICE
  { type: "single_choice", label: "Multiple choice (single)", hint: "Pick one (radio)", group: "choice", build: "ready", hasOptions: true, optionSource: "manual", badge: "()" },
  { type: "multiple_choice", label: "Multiple choice (multiple)", hint: "Pick one or more", group: "choice", build: "ready", hasOptions: true, optionSource: "manual", badge: "[]" },
  { type: "dropdown", label: "Dropdown", hint: "Pick one from a list", group: "choice", build: "ready", hasOptions: true, optionSource: "manual", badge: "v" },
  { type: "yes_no", label: "Yes / No", hint: "Simple yes or no", group: "choice", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: yn, badge: "YN" },
  { type: "true_false", label: "True / False", hint: "True or false", group: "choice", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: tf, badge: "TF" },

  // RATING
  { type: "rating", label: "Linear scale", hint: "Numeric scale, e.g. 1 to 5", group: "rating", build: "ready", hasOptions: false, scale: true, badge: "1-5" },
  { type: "star_rating", label: "Star rating", hint: "Rate with stars", group: "rating", build: "ready", hasOptions: false, scale: true, badge: "St" },
  { type: "likert", label: "Likert scale", hint: "Agree - disagree (5 point)", group: "rating", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: agreement, badge: "Lk" },
  { type: "satisfaction", label: "Satisfaction scale", hint: "Very dissatisfied - very satisfied", group: "rating", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: satisfaction, badge: "Sa" },
  { type: "agreement", label: "Agreement scale", hint: "Strongly disagree - strongly agree", group: "rating", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: agreement, badge: "Ag" },

  // ADVANCED
  { type: "ranking", label: "Ranking", hint: "Rank options in order", group: "advanced", build: "engine", hasOptions: true, optionSource: "manual", badge: "Rk" },
  { type: "matrix", label: "Matrix / grid", hint: "Rows rated on a shared scale", group: "advanced", build: "engine", hasOptions: true, grid: true, badge: "Mx" },
  { type: "mc_grid", label: "Multiple choice grid", hint: "Rows x single-choice columns", group: "advanced", build: "engine", hasOptions: true, grid: true, badge: "MG" },
  { type: "checkbox_grid", label: "Checkbox grid", hint: "Rows x multi-choice columns", group: "advanced", build: "engine", hasOptions: true, grid: true, badge: "CG" },
  { type: "constant_sum", label: "Constant sum", hint: "Distribute points across options", group: "advanced", build: "engine", hasOptions: true, optionSource: "manual", badge: "Sum" },
  { type: "slider", label: "Slider", hint: "Drag along a range", group: "advanced", build: "ready", hasOptions: false, scale: true, badge: "Sl" },
  { type: "image_choice", label: "Image choice", hint: "Pick from images", group: "advanced", build: "collect", hasOptions: true, optionSource: "manual", badge: "Im" },
  { type: "icon_choice", label: "Icon choice", hint: "Pick from icons", group: "advanced", build: "collect", hasOptions: true, optionSource: "manual", badge: "Ic" },

  // ELECTION-SPECIFIC
  { type: "party_selector", label: "Political party selector", hint: "Choose a political party", group: "election", build: "ready", hasOptions: true, optionSource: "party", badge: "Pt" },
  { type: "candidate_selector", label: "Candidate selector", hint: "Choose a candidate", group: "election", build: "ready", hasOptions: true, optionSource: "candidate", badge: "Cd" },
  { type: "constituency_selector", label: "Constituency selector", hint: "Choose a constituency", group: "election", build: "ready", hasOptions: true, optionSource: "constituency", badge: "Cn" },
  { type: "region_selector", label: "Region selector", hint: "Choose a region", group: "election", build: "ready", hasOptions: true, optionSource: "region", badge: "Rg" },
  { type: "district_selector", label: "District selector", hint: "Choose a district", group: "election", build: "ready", hasOptions: true, optionSource: "district", badge: "Ds" },
  { type: "polling_station_selector", label: "Polling station selector", hint: "Choose a polling station", group: "election", build: "collect", hasOptions: true, optionSource: "polling_station", badge: "PS" },
  { type: "incident_type", label: "Election incident type", hint: "Type of incident observed", group: "election", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: [
    { code: "violence", label: "Violence or intimidation" }, { code: "bribery", label: "Vote buying / bribery" },
    { code: "materials", label: "Missing or faulty materials" }, { code: "procedure", label: "Procedural violation" },
    { code: "obstruction", label: "Observer obstruction" }, { code: "other", label: "Other" },
  ], badge: "In" },
  { type: "observer_checklist", label: "Observer checklist", hint: "General observation checklist", group: "election", build: "ready", hasOptions: true, optionSource: "manual", badge: "Ob" },
  { type: "poll_opening_checklist", label: "Poll opening checklist", hint: "Opening procedures", group: "election", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: [
    { code: "on_time", label: "Station opened on time" }, { code: "materials_present", label: "All materials present" },
    { code: "box_shown_empty", label: "Ballot box shown empty" }, { code: "sealed", label: "Ballot box sealed" },
    { code: "agents_present", label: "Party agents present" },
  ], badge: "PO" },
  { type: "poll_closing_checklist", label: "Poll closing checklist", hint: "Closing procedures", group: "election", build: "ready", hasOptions: true, optionSource: "fixed", fixedOptions: [
    { code: "closed_on_time", label: "Station closed on time" }, { code: "queue_managed", label: "Closing queue handled per rules" },
    { code: "box_sealed", label: "Ballot box sealed for count" }, { code: "count_started", label: "Count started in station" },
    { code: "results_posted", label: "Results posted publicly" },
  ], badge: "PC" },

  // MEDIA
  { type: "photo", label: "Photo", hint: "Capture a photograph", group: "media", build: "collect", hasOptions: false, badge: "Ph" },
  { type: "video", label: "Video", hint: "Record video", group: "media", build: "collect", hasOptions: false, badge: "Vi" },
  { type: "audio", label: "Audio", hint: "Record audio", group: "media", build: "collect", hasOptions: false, badge: "Au" },
  { type: "signature", label: "Signature", hint: "Capture a signature", group: "media", build: "collect", hasOptions: false, badge: "Sg" },
  { type: "file_upload", label: "File upload", hint: "Attach a file", group: "media", build: "collect", hasOptions: false, badge: "Fi" },
  { type: "barcode", label: "Barcode", hint: "Scan a barcode", group: "media", build: "collect", hasOptions: false, badge: "Bc" },
  { type: "qr_code", label: "QR code", hint: "Scan a QR code", group: "media", build: "collect", hasOptions: false, badge: "QR" },

  // GPS
  { type: "gps", label: "GPS location", hint: "Capture coordinates", group: "gps", build: "collect", hasOptions: false, badge: "Gp" },
  { type: "map_pin", label: "Map pin", hint: "Drop a pin on a map", group: "gps", build: "collect", hasOptions: false, badge: "Pn" },
  { type: "geofence", label: "Geofence check", hint: "Confirm inside an area", group: "gps", build: "collect", hasOptions: false, badge: "Gf" },
];

export const GROUP_LABELS: Record<QGroup, string> = {
  basic: "Basic", choice: "Choice", rating: "Rating", advanced: "Advanced",
  election: "Election-specific", media: "Media", gps: "Location",
};
export const GROUP_ORDER: QGroup[] = ["basic", "choice", "rating", "advanced", "election", "media", "gps"];

export const qtype = (t: string) => QTYPES.find((q) => q.type === t);

export function toCode(label: string, existing: string[]): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "question";
  let code = base, n = 1;
  while (existing.includes(code)) code = base + "_" + (++n);
  return code;
}

export function defaultOptions(def: QTypeDef): { code: string; label: string }[] {
  if (def.fixedOptions) return def.fixedOptions.map((o) => ({ ...o }));
  if (def.grid) return [{ code: "row_1", label: "Row 1" }, { code: "row_2", label: "Row 2" }];
  if (def.hasOptions) return [{ code: "opt_1", label: "Option 1" }, { code: "opt_2", label: "Option 2" }];
  return [];
}

// grid types also need columns
export function defaultColumns(def: QTypeDef): { code: string; label: string }[] {
  if (!def.grid) return [];
  if (def.type === "matrix") return agreement.map((o) => ({ ...o }));
  return [{ code: "col_1", label: "Column 1" }, { code: "col_2", label: "Column 2" }];
}
