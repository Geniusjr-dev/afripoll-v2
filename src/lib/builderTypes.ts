// Shared shapes for the questionnaire builder.

export interface BOption { code: string; label: string; }
export interface BQuestion {
  id: string;                 // client-side stable id for DnD/editing
  code: string;               // stored code (snake_case)
  label: string;
  type: string;
  required: boolean;
  description?: string;
  help?: string;
  options: BOption[];         // choices, or grid rows
  columns?: BOption[];        // grid columns
  config?: any;               // { min, max, step } for scales
  validation?: { min?: number | null; max?: number | null; pattern?: string; maxLength?: number | null };
  defaultValue?: string;
  scoring?: Record<string, number>;
  randomise?: boolean;
  visibility?: "always" | "hidden";
  // skip logic / branching (engine-level; stored, interpreted by Collect later)
  skip?: { whenCode?: string; equals?: string; action?: "hide" | "show" } | null;
}

export interface BSection {
  id: string;
  title: string;
  description?: string;
  page: number;               // which page this section belongs to
  questions: BQuestion[];
}

export interface BDefinition {
  title: string;
  sections: BSection[];
  pageTitles: string[];       // titles per page index
}

export function uid(prefix = "q"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
