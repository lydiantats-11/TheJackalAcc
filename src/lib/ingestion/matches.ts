/**
 * Recalculates stored user ↔ opportunity matches with the current rule version.
 * Records the previous eligibility so a material change can be turned into a notification in Phase 5.
 */
import type postgres from "postgres";
import { assess } from "@/lib/domain/eligibility";
import type { MatchProfile } from "@/lib/domain/profile";
import { listOpportunities, loadRequirements, toMatchable, type OpportunityRow } from "@/lib/data/opportunities";

export async function recalcMatches(sql: postgres.Sql, opts: { opportunityIds?: string[]; userIds?: string[]; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  let opps: OpportunityRow[] = await listOpportunities(sql);
  if (opts.opportunityIds) opps = opps.filter((o) => opts.opportunityIds!.includes(o.id));
  if (opps.length === 0) return { assessed: 0, changed: 0 };
  const reqs = await loadRequirements(sql, opps.map((o) => o.id));
  const profiles = await sql<(MatchProfile & { user_id: string })[]>`
    SELECT p.* FROM user_profiles p JOIN users u ON u.id = p.user_id
    WHERE u.deleted_at IS NULL ${opts.userIds ? sql`AND p.user_id = ANY(${opts.userIds}::uuid[])` : sql``}`;
  let assessed = 0, changed = 0;
  for (const p of profiles) {
    for (const o of opps) {
      const a = assess(toMatchable(o, reqs.get(o.id) ?? []), p, { now });
      const [row] = await sql<{ changed: boolean }[]>`
        INSERT INTO user_opportunity_matches (user_id, opportunity_id, eligibility_status, relevance_score, evidence_coverage, unresolved_count,
                                              explanation, rule_version, assessed_at, availability, opportunity_version, changed_at)
        VALUES (${p.user_id}, ${o.id}, ${a.eligibility}, ${a.relevance_score}, ${a.evidence_coverage}, ${a.unresolved_count},
                ${sql.json({ rule: a.eligibility_rule, results: a.results.map((r) => ({ key: r.key, state: r.state, reason: r.reason })), questions: a.questions } as never)},
                ${a.rule_version}, ${now}, ${a.availability}, ${o.version}, ${now})
        ON CONFLICT (user_id, opportunity_id) DO UPDATE SET
          previous_eligibility = CASE WHEN user_opportunity_matches.eligibility_status <> EXCLUDED.eligibility_status
                                      THEN user_opportunity_matches.eligibility_status ELSE user_opportunity_matches.previous_eligibility END,
          eligibility_status = EXCLUDED.eligibility_status, relevance_score = EXCLUDED.relevance_score,
          evidence_coverage = EXCLUDED.evidence_coverage, unresolved_count = EXCLUDED.unresolved_count,
          explanation = EXCLUDED.explanation, rule_version = EXCLUDED.rule_version, assessed_at = EXCLUDED.assessed_at,
          availability = EXCLUDED.availability, opportunity_version = EXCLUDED.opportunity_version,
          changed_at = CASE WHEN user_opportunity_matches.eligibility_status <> EXCLUDED.eligibility_status
                              OR user_opportunity_matches.availability IS DISTINCT FROM EXCLUDED.availability
                            THEN EXCLUDED.changed_at ELSE user_opportunity_matches.changed_at END
        RETURNING (changed_at = ${now}) AS changed`;
      assessed++;
      if (row?.changed) changed++;
    }
  }
  return { assessed, changed };
}
