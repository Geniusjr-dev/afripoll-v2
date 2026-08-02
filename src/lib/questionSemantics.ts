// Classifies a survey question by what it is ABOUT, so narrative can interpret it
// in domain-appropriate terms rather than generic statistical language.
import { Question } from "./analytics";

export type Semantic =
  | "vote_retention"   // will you still vote for / vote intention
  | "vote_choice"      // which party/candidate
  | "approval"         // approve / satisfied / rate performance
  | "awareness"        // do you know / are you aware
  | "trust"            // trust / confidence / fair
  | "priority"         // most important issue / priority
  | "delivery"         // delivered / provided / condition of service
  | "participation"    // did you vote / will you vote (turnout)
  | "demographic"      // gender/age/education/occupation
  | "incident"         // incident / violence / irregularity
  | "generic";

const has = (s: string, ...kw: string[]) => kw.some((k) => s.includes(k));

export function classify(q: Question): Semantic {
  const L = (q.label || "").toLowerCase();
  const t = q.type;

  if (t === "party_selector" || has(L, "which party", "which candidate", "vote for in")) return "vote_choice";
  if (has(L, "still vote", "vote for your mp", "vote for the mp", "re-elect", "reelect", "vote for him", "vote for her", "vote for them again")) return "vote_retention";
  if (has(L, "did you vote", "will you vote", "intend to vote", "likely to vote", "turn out")) return "participation";
  if (has(L, "know your mp", "know who", "aware of", "heard of", "recognise", "recognize", "familiar with")) return "awareness";
  if (has(L, "trust", "confidence", "confident", "free and fair", "fairness", "credible", "credibility")) return "trust";
  if (has(L, "most important", "priority", "biggest problem", "main issue", "urgent", "should address")) return "priority";
  if (has(L, "delivered", "deliver", "provided", "condition of", "quality of", "access to", "state of")) return "delivery";
  if (has(L, "incident", "violence", "intimidation", "irregular", "malpractice", "bribery", "obstruction")) return "incident";
  if (has(L, "approve", "satisfied", "satisfaction", "rate the performance", "how would you rate", "performance of")) return "approval";
  if (has(L, "gender", "sex", "age", "how old", "education", "occupation", "employment", "religion", "ethnic", "marital", "income")) return "demographic";
  if (t === "rating" || t === "star_rating" || t === "likert" || t === "satisfaction" || t === "agreement") return "approval";
  return "generic";
}

// Domain-appropriate interpretation for a CHOICE result.
// dominant = the leading option; pct = its share; isYes = leading option is affirmative.
export function choiceInterpretation(sem: Semantic, dominantLabel: string, pct: number, isAffirmative: boolean, n: number): string {
  const strong = pct >= 70, clear = pct >= 60, slim = pct >= 50;
  const strength = strong ? "strong" : clear ? "clear" : "narrow";

  switch (sem) {
    case "vote_retention":
      if (isAffirmative) {
        if (strong) return "This points to a solid base of electoral support for the incumbent, suggesting that, on present evidence, the seat would likely be retained.";
        if (clear) return "This suggests the incumbent retains majority support, though the presence of a substantial dissenting minority indicates the seat is not wholly secure.";
        return "With support only marginally above half, the incumbent's position appears precarious: a relatively small shift in opinion could place re-election in doubt. The result is best read as a signal of electoral vulnerability rather than comfort.";
      } else {
        return "A majority indicating they would not re-elect the incumbent is a significant warning sign, pointing to meaningful dissatisfaction and a real prospect of the seat changing hands.";
      }
    case "participation":
      if (isAffirmative) return strong ? "This indicates high declared engagement with the electoral process among respondents." : "Declared willingness to participate is above half but not overwhelming, suggesting that turnout mobilisation could be consequential.";
      return "A large share indicating they would not participate raises concerns about turnout and civic engagement within the study area.";
    case "awareness":
      if (isAffirmative) return strong ? "This reflects a high level of public recognition, indicating the individual or issue is well known within the constituency." : "Recognition is present but not universal, suggesting scope to strengthen public visibility.";
      return "Limited awareness is itself a notable finding, pointing to a visibility or communication gap that may warrant attention.";
    case "trust":
      if (isAffirmative) return strong ? "This signals a healthy level of public trust, an important condition for institutional legitimacy." : "Trust is qualified rather than emphatic, and the sizeable share expressing reservations should not be overlooked.";
      return "A predominance of distrust is a serious finding, with implications for legitimacy and public confidence that merit close attention.";
    case "delivery":
      if (isAffirmative) return "Respondents largely acknowledge delivery in this area, a generally positive indicator of perceived performance.";
      return "The prevailing view that delivery has fallen short highlights a service or development gap that respondents evidently feel keenly.";
    case "vote_choice":
      return `On present evidence, "${dominantLabel}" holds the strongest position among respondents, though vote-choice questions are especially sensitive to sample composition and should be read with that caveat.`;
    case "incident":
      return "The pattern of reported incidents warrants attention, particularly where it concentrates around specific categories or locations examined later in this report.";
    default:
      if (slim) return strong ? `The pronounced concentration of responses on "${dominantLabel}" indicates a firm and consistent view among respondents.` : `A ${strength} preference for "${dominantLabel}" is evident, though the distribution of remaining responses should also be borne in mind.`;
      return `Responses were spread across categories, with "${dominantLabel}" most frequently selected but without commanding a majority.`;
  }
}

// Domain-appropriate interpretation for a NUMERIC/rating result.
export function ratingInterpretation(sem: Semantic, mean: number, min: number, max: number): string {
  const mid = (min + max) / 2, band = (max - min) * 0.12;
  const high = mean > mid + band, low = mean < mid - band;
  switch (sem) {
    case "approval":
      if (high) return "The elevated average rating indicates broadly favourable assessments of performance among respondents.";
      if (low) return "The below-midpoint average points to widespread dissatisfaction with performance, a finding with clear implications for those held to account.";
      return "The near-midpoint average suggests a lukewarm assessment: respondents are, on balance, neither clearly satisfied nor clearly dissatisfied, which itself may signal an absence of strong positive endorsement.";
    case "trust":
      if (high) return "Ratings sit towards the confident end of the scale, indicating comparatively healthy trust.";
      if (low) return "Low average ratings signal a deficit of confidence that merits attention.";
      return "Average confidence sits mid-scale, indicating cautious rather than assured sentiment.";
    default:
      if (high) return "The average sits towards the upper end of the scale, indicating a generally positive orientation among respondents.";
      if (low) return "The average sits towards the lower end of the scale, indicating a generally negative orientation among respondents.";
      return "The average sits close to the mid-point, indicating a broadly neutral balance of opinion.";
  }
}
