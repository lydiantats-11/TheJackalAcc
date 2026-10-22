/**
 * Milestone F: official source → opportunity record → structured requirements → profile matching →
 * explanation → notification-ready change. Uses the synthetic EU F&T fixture (no live network).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { freshDatabase, TEST_DB_URL } from "./db-helper";
import { fakeFetch, page, topic } from "./fixtures/eu-ft";
import { runSource } from "@/lib/ingestion/worker";
import { recalcMatches } from "@/lib/ingestion/matches";
import { registerUser, type SessionUser } from "@/lib/auth/service";
import { exportMyData, getProfile, listMyMatches, updateProfile } from "@/lib/data/user";
import { getOpportunity, listOpportunities, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { assess } from "@/lib/domain/eligibility";
import { runScenario } from "@/lib/domain/scenarios";

describe.skipIf(!TEST_DB_URL)("end-to-end: source to explained match (PostgreSQL)", () => {
  let sql: postgres.Sql;
  let ana: SessionUser, ben: SessionUser;
  let sourceId: string;
  const now = new Date("2026-10-13T10:00:00Z");

  beforeAll(async () => {
    sql = await freshDatabase();
    ana = await registerUser(sql, { email: "ana@test-data.example", password: "ana long password" });
    ben = await registerUser(sql, { email: "ben@test-data.example", password: "ben long password" });
    await updateProfile(sql, ana, { business_stage: "planning", application_country: "GR", region_codes: ["GR"], age_range: "25_29", project_budget_eur: "prefer_not" });
    await updateProfile(sql, ben, { business_stage: "established", legal_form: "company", application_country: "GR", employees_range: "prefer_not" });
    const [s] = await sql<{ id: string }[]>`INSERT INTO sources (slug, name, authority, scope, base_url, allowed_hosts, access_method, adapter)
      VALUES ('eu-funding-tenders', 'EU F&T', 'European Commission', 'eu', 'https://ec.europa.eu/', '{ec.europa.eu,api.tech.ec.europa.eu}', 'api', 'eu-funding-tenders-search') RETURNING id`;
    sourceId = s!.id;
  });
  afterAll(async () => { await sql?.end(); });

  it("ingests, matches with unknowns preserved, then re-matches after requirements are recorded", async () => {
    const f = fakeFetch([page([topic("TEST-E2E-01")])]);
    const run = await runSource(sql, sourceId, { trigger: "test", fetchImpl: f.impl, now: () => now, retry: { retries: 0 } });
    expect(run.status).toBe("succeeded");
    const [opp] = await listOpportunities(sql);
    expect(opp!.publication_basis).toBe("official_structured");
    // Industry filter (0008): a record not restricted to any industry is listed under every industry; a restricted one only under its own
    expect(opp!.industries).toBeNull();
    expect(await listOpportunities(sql, { industry: "tourism_hospitality" })).toHaveLength(1);
    await sql`UPDATE opportunities SET industries = '{agriculture}' WHERE id = ${opp!.id}`;
    expect(await listOpportunities(sql, { industry: "tourism_hospitality" })).toHaveLength(0);
    expect(await listOpportunities(sql, { industry: "agriculture" })).toHaveLength(1);
    await sql`UPDATE opportunities SET industries = NULL WHERE id = ${opp!.id}`;

    // No requirements extracted yet → never "eligible", always "insufficient information"
    const before = await listMyMatches(sql, ana);
    expect(before).toEqual([expect.objectContaining({ eligibility_status: "insufficient_information", availability: "open" })]);

    // A reviewer records the official requirements (Phase 3 will do this via extraction + review)
    await sql`INSERT INTO opportunity_requirements (opportunity_id, requirement_key, category, kind, value, original_text, original_lang, evidence, evidence_rank, confidence, origin, verified_at)
      VALUES
      (${opp!.id}, 'stage', 'business_stage', 'mandatory', ${sql.json({ stages: ["registered_new", "established"] })}, '[TEST] Only legal entities established in a Member State may apply.', 'en', ${sql.json({ source_url: opp!.canonical_url, location: "Conditions §2" })}, 1, 'high', 'admin', now()),
      (${opp!.id}, 'size', 'company_size', 'conditional', ${sql.json({ max_employees: 249 })}, '[TEST] Applicants must be SMEs.', 'en', ${sql.json({ source_url: opp!.canonical_url })}, 1, 'high', 'admin', now())`;
    await sql`UPDATE opportunity_requirements SET applies_to = '{company}' WHERE requirement_key = 'size'`;
    await sql`UPDATE opportunities SET requirement_set_completeness = 'complete', requirement_set_version = 1 WHERE id = ${opp!.id}`;
    await recalcMatches(sql, { now });

    const [anaMatch] = await listMyMatches(sql, ana);
    expect(anaMatch).toMatchObject({ eligibility_status: "ineligible_verified", previous_eligibility: "insufficient_information" });
    const [benMatch] = await listMyMatches(sql, ben);
    // Ben declined to give employee numbers: SME rule stays unknown, never assumed
    expect(benMatch).toMatchObject({ eligibility_status: "potentially_eligible_verification_required" });

    // Unclassified (HOLD) records are never served publicly, not even by direct id, and never listed for a path (0011)
    expect(await getOpportunity(sql, opp!.id)).toBeNull();
    expect(await listOpportunities(sql, { audience: "business" })).toHaveLength(0);
    await sql`UPDATE opportunities SET audience = 'business' WHERE id = ${opp!.id}`;
    expect(await listOpportunities(sql, { audience: "citizen" })).toHaveLength(0);
    expect(await listOpportunities(sql, { audience: "business" })).toHaveLength(1);

    // The explanation shown to the user carries the official wording and source location
    const row = (await getOpportunity(sql, opp!.id))!;
    expect(row.audience).toBe("business");
    const reqs = (await loadRequirements(sql, [opp!.id])).get(opp!.id)!;
    const a = assess(toMatchable(row, reqs), await getProfile(sql, ben), { now });
    const size = a.results.find((r) => r.key === "size")!;
    expect(size).toMatchObject({ state: "unknown", question: "employees_range", original_text: "[TEST] Applicants must be SMEs." });

    // A scenario for Ana is hypothetical and leaves her stored profile and match untouched
    const sc = runScenario(toMatchable(row, reqs), await getProfile(sql, ana), { kind: "register_business", legal_form: "company", registration_date: "2026-12-01" }, now);
    expect(sc.outcome.eligibility).not.toBe("ineligible_verified");
    expect((await getProfile(sql, ana)).business_stage).toBe("planning");
    expect((await listMyMatches(sql, ana))[0]!.eligibility_status).toBe("ineligible_verified");
  });

  it("#20 users only see their own matches and exports", async () => {
    const exp = await exportMyData(sql, ana);
    expect(JSON.stringify(exp)).not.toContain("ben@test-data.example");
    expect((exp.matches as unknown[]).length).toBe(1);
    const benRows = await listMyMatches(sql, ben);
    expect(benRows.every((m) => m.opportunity_id)).toBe(true);
    expect(benRows.length).toBe(1);
  });

  it("explicit 'prefer not to answer' is stored distinctly from 'not asked'", async () => {
    const p = await getProfile(sql, ana);
    expect(p.project_budget_eur).toBe("prefer_not");
    expect(p.employees_range).toBeNull();
  });
});
