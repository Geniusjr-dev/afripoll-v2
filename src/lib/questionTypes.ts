// Question types the Builder offers. `type` matches what analytics.ts understands.
export interface QTypeDef { type: string; label: string; hint: string; hasOptions: boolean; }

export const QTYPES: QTypeDef[] = [
  { type: "single_choice", label: "Multiple choice", hint: "Pick one (radio buttons)", hasOptions: true },
  { type: "multiple_choice", label: "Checkboxes", hint: "Pick one or more", hasOptions: true },
  { type: "dropdown", label: "Dropdown", hint: "Pick one from a list", hasOptions: true },
  { type: "yes_no", label: "Yes / No", hint: "Simple yes or no", hasOptions: false },
  { type: "likert", label: "Likert scale", hint: "Agree - disagree (5 point)", hasOptions: true },
  { type: "rating", label: "Linear scale", hint: "Numeric scale, e.g. 1 to 5", hasOptions: false },
  { type: "number", label: "Number", hint: "A numeric answer", hasOptions: false },
  { type: "short_text", label: "Short answer", hint: "One line of text", hasOptions: false },
  { type: "long_text", label: "Paragraph", hint: "Longer free text", hasOptions: false },
  { type: "date", label: "Date", hint: "A calendar date", hasOptions: false },
  { type: "time", label: "Time", hint: "A time of day", hasOptions: false },
  { type: "gps", label: "GPS location", hint: "Capture coordinates", hasOptions: false },
];

export const qtype = (t: string) => QTYPES.find((q) => q.type === t);

// Turn a label into a stable snake_case code (matches how v1 codes look: do_you_know_your_mp)
export function toCode(label: string, existing: string[]): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "question";
  let code = base, n = 1;
  while (existing.includes(code)) { code = base + "_" + (++n); }
  return code;
}

// Likert default options
export const LIKERT_OPTIONS = [
  { code: "strongly_disagree", label: "Strongly disagree" },
  { code: "disagree", label: "Disagree" },
  { code: "neutral", label: "Neutral" },
  { code: "agree", label: "Agree" },
  { code: "strongly_agree", label: "Strongly agree" },
];
