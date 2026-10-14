/**
 * User-owned data. Every function takes the authenticated `actor` and scopes by actor.id —
 * there is deliberately no way to pass another user's id, so cross-user reads are impossible by construction.
 */
import type postgres from "postgres";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/service";
import type { MatchProfile } from "@/lib/domain/profile";
import { INTEREST_IDS, PERSONA_IDS } from "@/lib/domain/personas";

const opt = <T extends [string, ...string[]]>(values: T) => z.enum(values).nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(new Date(d).getTime()));
const amount = z.union([z.number().int().nonnegative().max(9_999_999_999), z.enum(["not_sure", "prefer_not"])]).nullable().optional();

export const profileInputSchema = z.object({
  persona: opt(["individual", "aspiring_entrepreneur", "existing_business", "tender_applicant", "adviser"]),
  personas: z.array(z.enum(PERSONA_IDS)).max(PERSONA_IDS.length).nullable().optional(),
  interests: z.array(z.enum(INTEREST_IDS)).max(INTEREST_IDS.length).nullable().optional(),
  housing_status: opt(["renting", "with_family", "owner", "other", "not_sure", "prefer_not"]),
  first_home_purchase: opt(["yes", "no", "not_sure"]),
  household_size: opt(["1", "2", "3", "4", "5_plus", "prefer_not"]),
  dependent_children: opt(["0", "1", "2", "3_plus", "prefer_not"]),
  household_income_range: opt(["under_10k", "10k_20k", "20k_35k", "35k_60k", "over_60k", "not_sure", "prefer_not"]),
  property_owned: opt(["yes", "no", "not_sure", "prefer_not"]),
  country_of_residence: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  tax_residence_country: z.string().regex(/^([A-Z]{2}|not_sure|prefer_not)$/).nullable().optional(),
  application_country: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  region_codes: z.array(z.string().regex(/^(GR|EL[0-9]{2})$/)).max(20).nullable().optional(),
  willing_to_relocate: opt(["yes", "no", "not_sure"]),
  age_range: opt(["under_18", "18_24", "25_29", "30_34", "35_39", "40_44", "45_54", "55_64", "65_plus", "prefer_not"]),
  birth_year: z.number().int().min(1900).max(2100).nullable().optional(),
  employment_status: opt(["employed", "self_employed", "unemployed", "student", "inactive", "not_sure", "prefer_not"]),
  dypa_registered: opt(["yes", "no", "not_sure", "prefer_not"]),
  education_level: opt(["none", "secondary", "post_secondary", "bachelor", "master", "doctorate", "master_or_doctorate", "not_sure", "prefer_not"]),
  sectors: z.array(z.string().regex(/^([A-U]|\*)$/)).max(21).nullable().optional(),
  business_stage: opt(["idea", "planning", "registered_new", "established", "not_sure"]),
  legal_form: opt(["sole_proprietor", "company", "partnership", "cooperative", "nonprofit", "not_sure"]),
  business_registration_date: z.union([isoDate, z.literal("not_sure")]).nullable().optional(),
  business_region: z.string().regex(/^(EL[0-9]{2}|not_sure)$/).nullable().optional(),
  employees_range: opt(["0", "1_9", "10_49", "50_249", "250_plus", "not_sure", "prefer_not"]),
  turnover_range: opt(["under_100k", "100k_2m", "2m_10m", "10m_50m", "over_50m", "not_sure", "prefer_not"]),
  own_contribution_range: opt(["none", "under_5k", "5k_20k", "20k_50k", "over_50k", "not_sure", "prefer_not"]),
  project_budget_eur: amount,
  planned_project_start: z.union([isoDate, z.literal("not_sure")]).nullable().optional(),
  de_minimis_received_3y_eur: amount,
  balance_sheet_range: opt(["under_100k", "100k_2m", "2m_10m", "10m_50m", "over_50m", "not_sure", "prefer_not"]),
  enterprise_relationship: opt(["autonomous", "partner_or_linked", "not_sure"]),
  public_ownership_25: opt(["yes", "no", "not_sure"]),
  municipality: z.string().trim().min(2).max(80).nullable().optional(),
  has_consortium_partners: opt(["yes", "no", "not_sure"]),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

const PROFILE_COLUMNS = Object.keys(profileInputSchema.shape) as (keyof ProfileInput)[];
const NUMERIC_TEXT = new Set(["project_budget_eur", "de_minimis_received_3y_eur"]);

export async function getProfile(sql: postgres.Sql, actor: SessionUser): Promise<MatchProfile> {
  const [p] = await sql<Record<string, unknown>[]>`SELECT ${sql(PROFILE_COLUMNS as string[])} FROM user_profiles WHERE user_id = ${actor.id}`;
  if (!p) return {};
  for (const k of NUMERIC_TEXT) {
    const v = p[k];
    if (typeof v === "string" && /^[0-9]+$/.test(v)) p[k] = Number(v);
  }
  return p as MatchProfile;
}

/** Full replace of the matching profile (fields not sent become "not asked"). */
export async function updateProfile(sql: postgres.Sql, actor: SessionUser, input: unknown): Promise<void> {
  const parsed = profileInputSchema.parse(input);
  const row: Record<string, any> = { user_id: actor.id, updated_at: new Date() };
  for (const k of PROFILE_COLUMNS) {
    const v = parsed[k];
    row[k] = v === undefined ? null : NUMERIC_TEXT.has(k) && typeof v === "number" ? String(v) : v;
  }
  const cols = Object.keys(row);
  await sql`INSERT INTO user_profiles ${sql(row, cols)}
            ON CONFLICT (user_id) DO UPDATE SET ${sql(Object.fromEntries(cols.filter((c) => c !== "user_id").map((c) => [c, row[c]])))}`;
}

export async function toggleSaved(sql: postgres.Sql, actor: SessionUser, opportunityId: string): Promise<boolean> {
  const removed = await sql`DELETE FROM saved_opportunities WHERE user_id = ${actor.id} AND opportunity_id = ${opportunityId} RETURNING 1`;
  if (removed.length > 0) return false;
  await sql`INSERT INTO saved_opportunities (user_id, opportunity_id) VALUES (${actor.id}, ${opportunityId})`;
  return true;
}

export async function listSavedIds(sql: postgres.Sql, actor: SessionUser): Promise<string[]> {
  const rows = await sql<{ opportunity_id: string }[]>`SELECT opportunity_id FROM saved_opportunities WHERE user_id = ${actor.id}`;
  return rows.map((r) => r.opportunity_id);
}

/** The actor's stored match results (never another user's). */
export async function listMyMatches(sql: postgres.Sql, actor: SessionUser) {
  return sql<{ opportunity_id: string; eligibility_status: string; previous_eligibility: string | null; availability: string | null; changed_at: Date | null }[]>`
    SELECT opportunity_id, eligibility_status, previous_eligibility, availability, changed_at FROM user_opportunity_matches WHERE user_id = ${actor.id}`;
}

/** GDPR export: everything stored about the actor. */
export async function exportMyData(sql: postgres.Sql, actor: SessionUser) {
  const [user] = await sql`SELECT id, email, role, locale, created_at FROM users WHERE id = ${actor.id}`;
  return {
    user,
    profile: await getProfile(sql, actor),
    saved: await sql`SELECT opportunity_id, notes, created_at FROM saved_opportunities WHERE user_id = ${actor.id}`,
    notification_preferences: (await sql`SELECT * FROM notification_preferences WHERE user_id = ${actor.id}`)[0] ?? null,
    notifications: await sql`SELECT event_type, status, created_at, sent_at FROM notifications WHERE user_id = ${actor.id}`,
    matches: await listMyMatches(sql, actor),
  };
}

/** GDPR erasure: deletes the account; ON DELETE CASCADE removes profile, sessions, saved items, matches, notifications. */
export async function deleteMyAccount(sql: postgres.Sql, actor: SessionUser): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id) VALUES (NULL, 'account_deleted', 'user', ${actor.id})`;
    await tx`DELETE FROM users WHERE id = ${actor.id}`;
  });
}
