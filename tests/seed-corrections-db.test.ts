/**
 * Regression test for CI run 39947182245 (commit 0394224, 23 Oct 2026): «Database with real data» failed at
 * db/seed/corrections-2026-10-23.sql:52 with
 *   ERROR: new row for relation "opportunities" violates check constraint "opportunities_check3"
 * opportunities_check3 = CHECK (deadline_state <> 'known' OR closes_at IS NOT NULL). The P0 update of Article 5Α set
 * closes_at = NULL (no confirmed application period) but left deadline_state = 'known'. Fixed in 4ad41c2: with no
 * confirmed period the seed sets deadline_state = 'unknown', deadline_kind = 'not_announced', status = 'unverified'.
 *
 * Applies the seeds in the order of the CI step (without the network import of EU records) to a fresh test schema.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";
import { TEST_DB_URL, freshDatabase } from "./db-helper";

const root = join(__dirname, "..");
const seed = (name: string) => readFileSync(join(root, "db/seed", `${name}.sql`), "utf8");
const BEFORE = [
  "official-records-2026-10-14", "approvals-2026-10-15", "business-records-2026-10-20", "approvals-2026-10-20",
  "audience-2026-10-22", "corrections-2026-10-22",
];
/** The records the 23 Oct corrections are approved to change (Phase 1.1 + P0). */
const INTENDED = ["manual:art5a", "manual:art5b", "opske:23466", "opske:23487"];

/** Every record, without the timestamps the database sets itself. */
async function snapshot(sql: postgres.Sql) {
  const rows = await sql<{ k: string; h: string }[]>`
    SELECT external_key AS k, md5((to_jsonb(o) - 'updated_at' - 'created_at')::text) AS h FROM opportunities o ORDER BY external_key`;
  const reqs = await sql<{ k: string; h: string }[]>`
    SELECT o.external_key AS k, md5(string_agg(to_jsonb(r)::text, '|' ORDER BY r.id)) AS h
    FROM opportunity_requirements r JOIN opportunities o ON o.id = r.opportunity_id GROUP BY o.external_key ORDER BY 1`;
  return { rows: Object.fromEntries(rows.map((r) => [r.k, r.h])), reqs: Object.fromEntries(reqs.map((r) => [r.k, r.h])) };
}
const changed = (a: Record<string, string>, b: Record<string, string>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();

describe("corrections-2026-10-23.sql against the schema — static check (no database needed)", () => {
  const sql = seed("corrections-2026-10-23");
  it("every update that sets closes_at also sets a deadline_state the schema accepts with it", () => {
    const sets = [...sql.matchAll(/closes_at = (NULL|'[^']+'),([^\n]*)/g)];
    expect(sets.length).toBeGreaterThanOrEqual(2);
    for (const [, value, rest] of sets) {
      if (value === "NULL") expect(rest, "closes_at NULL needs deadline_state <> 'known'").toMatch(/deadline_state = '(unknown|rolling|not_applicable)'/);
      else expect(rest, "a closes_at needs deadline_state = 'known'").toMatch(/deadline_state = 'known'/);
    }
  });
  it("is one transaction, guarded so a rerun changes nothing", () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toContain("last_verified_at IS DISTINCT FROM '2026-10-23T12:00:00+03:00'");
  });
});

describe.skipIf(!TEST_DB_URL)("corrections-2026-10-23.sql on PostgreSQL (CI run 39947182245)", () => {
  let sql: postgres.Sql;
  let before: Awaited<ReturnType<typeof snapshot>>;
  beforeAll(async () => {
    sql = await freshDatabase();
    for (const s of BEFORE) await sql.unsafe(seed(s));
    before = await snapshot(sql);
    await sql.unsafe(seed("corrections-2026-10-23"));
  });
  afterAll(async () => { await sql?.end(); });

  it("Article 5Α: no confirmed period → no deadline, deadline_state 'unknown', «Υπό επιβεβαίωση»", async () => {
    const [r] = await sql`SELECT deadline_state, deadline_kind, closes_at, status FROM opportunities WHERE external_key = 'manual:art5a'`;
    expect(r).toEqual({ deadline_state: "unknown", deadline_kind: "not_announced", closes_at: null, status: "unverified" });
  });
  it("Article 5Β: only the confirmed 2026 period (31/10/2026 23:59 Athens), never 31/10/2027", async () => {
    const [r] = await sql`SELECT deadline_state, deadline_kind, closes_at, status FROM opportunities WHERE external_key = 'manual:art5b'`;
    expect(r!.deadline_state).toBe("known");
    expect(r!.deadline_kind).toBe("official");
    expect(new Date(r!.closes_at).toISOString()).toBe("2026-10-31T21:59:59.000Z");
    expect(r!.status).toBe("open");
    const [n] = await sql`SELECT count(*)::int AS n FROM opportunities WHERE external_key IN ('manual:art5a','manual:art5b') AND closes_at >= '2027-01-01'`;
    expect(n!.n).toBe(0);
  });
  it("changes only the approved records; requirements only of 5Α / 5Β", async () => {
    const after = await snapshot(sql);
    expect(changed(before.rows, after.rows)).toEqual(INTENDED);
    for (const k of changed(before.reqs, after.reqs)) expect(["manual:art5a", "manual:art5b"]).toContain(k);
  });
  it("a rerun changes nothing", async () => {
    const once = await snapshot(sql);
    await sql.unsafe(seed("corrections-2026-10-23"));
    const twice = await snapshot(sql);
    expect(twice).toEqual(once);
  });
  it("the check constraints are still in force", async () => {
    const defs = await sql<{ conname: string; def: string }[]>`
      SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'opportunities'::regclass AND conname IN ('opportunities_check3', 'opportunities_check4') ORDER BY conname`;
    expect(defs.map((d) => d.def)).toEqual([
      "CHECK (((deadline_state <> 'known'::text) OR (closes_at IS NOT NULL)))",
      "CHECK (((deadline_state = 'known'::text) OR (closes_at IS NULL)))",
    ]);
    await expect(sql`UPDATE opportunities SET closes_at = NULL WHERE external_key = 'manual:art5b'`).rejects.toThrow(/opportunities_check3/);
    await expect(sql`UPDATE opportunities SET closes_at = now() WHERE external_key = 'manual:art5a'`).rejects.toThrow(/opportunities_check4/);
  });
});
