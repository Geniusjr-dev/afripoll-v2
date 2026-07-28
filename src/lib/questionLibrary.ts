// Question Library: common ready-made questions inserted with one click.
// Templates: whole starter questionnaires the user can load and customise.

export interface LibQuestion {
  key: string; label: string; type: string;
  options?: { code: string; label: string }[];
  config?: any; description?: string;
}

export const QUESTION_LIBRARY: LibQuestion[] = [
  { key: "gender", label: "What is your gender?", type: "single_choice", options: [
    { code: "male", label: "Male" }, { code: "female", label: "Female" }, { code: "other", label: "Prefer not to say" } ] },
  { key: "age", label: "What is your age?", type: "number", config: { min: 18, max: 120 } },
  { key: "age_group", label: "Which age group are you in?", type: "single_choice", options: [
    { code: "18_24", label: "18-24" }, { code: "25_34", label: "25-34" }, { code: "35_44", label: "35-44" },
    { code: "45_54", label: "45-54" }, { code: "55_64", label: "55-64" }, { code: "65_plus", label: "65+" } ] },
  { key: "education", label: "What is your highest level of education?", type: "single_choice", options: [
    { code: "none", label: "No formal education" }, { code: "primary", label: "Primary" }, { code: "jhs", label: "JHS / Middle" },
    { code: "shs", label: "SHS / Secondary" }, { code: "tertiary", label: "Tertiary" }, { code: "postgrad", label: "Postgraduate" } ] },
  { key: "occupation", label: "What is your main occupation?", type: "single_choice", options: [
    { code: "farmer", label: "Farmer" }, { code: "trader", label: "Trader" }, { code: "artisan", label: "Artisan" },
    { code: "public", label: "Public sector" }, { code: "private", label: "Private sector" }, { code: "student", label: "Student" },
    { code: "unemployed", label: "Unemployed" }, { code: "other", label: "Other" } ] },
  { key: "political_party", label: "Which political party do you support?", type: "party_selector" },
  { key: "constituency", label: "Which constituency are you in?", type: "constituency_selector" },
  { key: "district", label: "Which district are you in?", type: "district_selector" },
  { key: "region", label: "Which region are you in?", type: "region_selector" },
  { key: "religion", label: "What is your religion?", type: "single_choice", options: [
    { code: "christian", label: "Christian" }, { code: "muslim", label: "Muslim" }, { code: "traditional", label: "Traditional" },
    { code: "none", label: "None" }, { code: "other", label: "Other" } ] },
  { key: "ethnicity", label: "What is your ethnic background?", type: "short_text" },
];

export interface Template { key: string; name: string; blurb: string; questions: LibQuestion[]; }

const q = (label: string, type: string, options?: any, config?: any): LibQuestion => ({ key: "", label, type, options, config });

export const TEMPLATES: Template[] = [
  { key: "mp_performance", name: "MP Performance Survey", blurb: "Assess accessibility, responsiveness and delivery.", questions: [
    QUESTION_LIBRARY[0], QUESTION_LIBRARY[2], QUESTION_LIBRARY[3], QUESTION_LIBRARY[8],
    q("Do you know who your MP is?", "yes_no"),
    q("How would you rate your MP's overall performance?", "rating", undefined, { min: 1, max: 5 }),
    q("How accessible is your MP to constituents?", "satisfaction"),
    q("Has your MP delivered on development promises?", "agreement"),
    q("What is the most important issue your MP should address?", "long_text"),
  ] },
  { key: "exit_poll", name: "Exit Poll Questionnaire", blurb: "Capture how people voted as they leave.", questions: [
    QUESTION_LIBRARY[0], QUESTION_LIBRARY[2], QUESTION_LIBRARY[8],
    q("Did you vote today?", "yes_no"),
    q("Which party did you vote for?", "party_selector"),
    q("What was the main issue behind your vote?", "single_choice", [
      { code: "economy", label: "Economy" }, { code: "jobs", label: "Jobs" }, { code: "education", label: "Education" },
      { code: "health", label: "Health" }, { code: "corruption", label: "Corruption" }, { code: "other", label: "Other" } ]),
    q("How confident are you the election was fair?", "agreement"),
  ] },
  { key: "voter_opinion", name: "Voter Opinion Poll", blurb: "Pre-election preference and issue salience.", questions: [
    QUESTION_LIBRARY[0], QUESTION_LIBRARY[2], QUESTION_LIBRARY[8], QUESTION_LIBRARY[5],
    q("If elections were held today, which party would you vote for?", "party_selector"),
    q("How likely are you to vote?", "rating", undefined, { min: 1, max: 5 }),
    q("Which issue matters most to you?", "single_choice", [
      { code: "economy", label: "Economy" }, { code: "jobs", label: "Jobs" }, { code: "education", label: "Education" },
      { code: "health", label: "Health" }, { code: "infrastructure", label: "Infrastructure" } ]),
  ] },
  { key: "election_observation", name: "Election Observation Form", blurb: "Polling-day observation checklist.", questions: [
    q("Polling station", "polling_station_selector"),
    q("Time of observation", "time"),
    q("Opening procedures", "poll_opening_checklist"),
    q("Were party agents present?", "yes_no"),
    q("Any incident observed?", "incident_type"),
    q("Describe the incident", "long_text"),
    q("Photo evidence", "photo"),
    q("Location", "gps"),
  ] },
  { key: "constituency_scorecard", name: "Constituency Scorecard", blurb: "Rate local services and delivery.", questions: [
    QUESTION_LIBRARY[6],
    q("Rate the condition of local roads", "rating", undefined, { min: 1, max: 5 }),
    q("Rate access to healthcare", "rating", undefined, { min: 1, max: 5 }),
    q("Rate the quality of schools", "rating", undefined, { min: 1, max: 5 }),
    q("Rate access to clean water", "rating", undefined, { min: 1, max: 5 }),
    q("Rate electricity supply", "rating", undefined, { min: 1, max: 5 }),
    q("Most urgent development priority", "long_text"),
  ] },
  { key: "incident_reporting", name: "Incident Reporting Form", blurb: "Structured incident capture.", questions: [
    q("Incident type", "incident_type"),
    q("When did it occur?", "time"),
    q("Where did it occur?", "constituency_selector"),
    q("Describe what happened", "long_text"),
    q("Severity", "rating", undefined, { min: 1, max: 5 }),
    q("Photo evidence", "photo"),
    q("Location", "gps"),
  ] },
  { key: "enumerator_registration", name: "Enumerator Registration", blurb: "Register field staff.", questions: [
    q("Full name", "short_text"),
    q("Phone number", "phone"),
    q("Email", "email"),
    q("Assigned region", "region_selector"),
    q("Assigned constituency", "constituency_selector"),
    q("Signature", "signature"),
  ] },
  { key: "household_survey", name: "Household Survey", blurb: "General household demographics.", questions: [
    QUESTION_LIBRARY[8], QUESTION_LIBRARY[7],
    q("How many people live in this household?", "number"),
    QUESTION_LIBRARY[3], QUESTION_LIBRARY[4], QUESTION_LIBRARY[9],
    q("Main source of drinking water", "single_choice", [
      { code: "pipe", label: "Piped water" }, { code: "borehole", label: "Borehole" }, { code: "well", label: "Well" },
      { code: "river", label: "River / stream" }, { code: "other", label: "Other" } ]),
  ] },
];
