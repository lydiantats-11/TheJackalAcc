/**
 * Ask only what matters (core capability 4: privacy-preserving personalisation; Stage 2 priority 2).
 * Ranks the profile questions still unanswered by how many current opportunities each one would help decide,
 * instead of rewarding people for handing over more personal data. A question no current rule needs is never asked.
 */
import type { Assessment } from "./eligibility";

export interface QuestionImpact {
  question: string;
  /** Opportunities whose result this answer could change. */
  unlocks: number;
  /** Of those, how many it alone would settle (it is the only open question there). */
  decisive: number;
}

const SETTLED: Assessment["eligibility"][] = ["ineligible_verified", "unlikely_eligible"];

export function rankQuestions(assessments: Assessment[]): QuestionImpact[] {
  const by = new Map<string, QuestionImpact>();
  for (const a of assessments) {
    if (SETTLED.includes(a.eligibility)) continue; // already decided by a failed condition: more data would not help
    const qs = [...new Set(a.questions)];
    for (const q of qs) {
      const cur = by.get(q) ?? { question: q, unlocks: 0, decisive: 0 };
      cur.unlocks += 1;
      if (qs.length === 1) cur.decisive += 1;
      by.set(q, cur);
    }
  }
  return [...by.values()].sort((x, y) => y.unlocks - x.unlocks || y.decisive - x.decisive || x.question.localeCompare(y.question));
}
