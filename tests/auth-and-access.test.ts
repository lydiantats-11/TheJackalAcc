import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { freshDatabase, TEST_DB_URL } from "./db-helper";
import {
  AuthError, createSession, destroySession, registerUser, userForSessionToken, verifyLogin, type SessionUser,
} from "@/lib/auth/service";
import { getProfile, listSavedIds, toggleSaved, updateProfile, deleteMyAccount } from "@/lib/data/user";
import { listSourceHealth, setSourceEnabled } from "@/lib/data/admin";

describe.skipIf(!TEST_DB_URL)("auth & access control (PostgreSQL)", () => {
  let sql: postgres.Sql;
  let alice: SessionUser, bob: SessionUser;
  let oppId: string;

  beforeAll(async () => {
    sql = await freshDatabase();
    alice = await registerUser(sql, { email: "alice@test-data.example", password: "correct horse battery" });
    bob = await registerUser(sql, { email: "bob@test-data.example", password: "another long password" });
    const [o] = await sql<{ id: string }[]>`INSERT INTO opportunities (is_synthetic, official_title, canonical_url, review_status)
                                            VALUES (true, '[TEST] x', 'https://test-data.example/o/1', 'approved') RETURNING id`;
    oppId = o!.id;
    await sql`INSERT INTO sources (slug, name, authority, scope, base_url, allowed_hosts, access_method, adapter)
              VALUES ('t', 'Test source', 'Test', 'national', 'https://test-data.example/', '{test-data.example}', 'html', 'manual')`;
  });
  afterAll(async () => { await sql?.end(); });

  it("stores no plaintext passwords and rejects duplicate emails (case-insensitive)", async () => {
    const [row] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${alice.id}`;
    expect(row!.password_hash.startsWith("scrypt$")).toBe(true);
    expect(row!.password_hash).not.toContain("correct horse");
    await expect(registerUser(sql, { email: "ALICE@test-data.example", password: "xxxxxxxxxxxx" })).rejects.toMatchObject({ code: "email_taken" });
    await expect(registerUser(sql, { email: "short@test-data.example", password: "short" })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("logs in with valid credentials and issues a session whose raw token is not stored", async () => {
    const u = await verifyLogin(sql, { email: "Alice@test-data.example", password: "correct horse battery" }, "198.51.100.1");
    const { token } = await createSession(sql, u.id);
    expect((await userForSessionToken(sql, token))?.id).toBe(alice.id);
    const stored = await sql`SELECT 1 FROM sessions WHERE token_hash = ${token}`;
    expect(stored.length).toBe(0);
    await destroySession(sql, token);
    expect(await userForSessionToken(sql, token)).toBeNull();
  });

  it("rate-limits repeated failed logins", async () => {
    for (let i = 0; i < 5; i++)
      await expect(verifyLogin(sql, { email: "bob@test-data.example", password: "wrong-password!" }, null)).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(verifyLogin(sql, { email: "bob@test-data.example", password: "another long password" }, null)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("#15 an ordinary user cannot use admin functions", async () => {
    await expect(listSourceHealth(sql, alice)).rejects.toBeInstanceOf(AuthError);
    await expect(listSourceHealth(sql, null)).rejects.toMatchObject({ code: "unauthenticated" });
    const [src] = await sql<{ id: string }[]>`SELECT id FROM sources LIMIT 1`;
    await expect(setSourceEnabled(sql, alice, src!.id, true)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("admins cannot enable an untested source; actions are audited", async () => {
    await sql`UPDATE users SET role = 'admin' WHERE id = ${bob.id}`;
    const admin = { ...bob, role: "admin" as const };
    const [src] = await sql<{ id: string }[]>`SELECT id FROM sources LIMIT 1`;
    expect(await setSourceEnabled(sql, admin, src!.id, true)).toEqual({ ok: false, reason: "must_pass_test_first" });
    expect((await setSourceEnabled(sql, admin, src!.id, false)).ok).toBe(true);
    const logs = await sql`SELECT action FROM audit_logs WHERE entity_id = ${src!.id}`;
    expect(logs.map((l) => l.action)).toContain("source_disabled");
    expect((await listSourceHealth(sql, admin)).length).toBe(1);
  });

  it("#16 users only ever see their own profile and saved items", async () => {
    await updateProfile(sql, alice, { age_range: "25_29", business_stage: "planning", sectors: ["*"] });
    await toggleSaved(sql, alice, oppId);
    expect((await getProfile(sql, alice)).age_range).toBe("25_29");
    expect((await getProfile(sql, bob)).age_range).toBeNull();
    expect(await listSavedIds(sql, alice)).toEqual([oppId]);
    expect(await listSavedIds(sql, bob)).toEqual([]);
  });

  it("rejects invalid profile values instead of storing them", async () => {
    await expect(updateProfile(sql, alice, { age_range: "26" })).rejects.toThrow();
    await expect(updateProfile(sql, alice, { region_codes: ["'; DROP TABLE users;--"] })).rejects.toThrow();
  });

  it("row-level security is enabled on every application table", async () => {
    const rows = await sql<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity AND tablename <> 'schema_migrations'`;
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it("Supabase API roles have NO privileges — even though they were granted defaults before migrating", async () => {
    const grants = await sql`SELECT table_name, privilege_type FROM information_schema.role_table_grants
                             WHERE grantee IN ('anon','authenticated') AND table_schema = 'public'`;
    expect(grants).toEqual([]);
    await expect(sql.begin(async (tx) => { await tx`SET LOCAL ROLE anon`; await tx`SELECT count(*) FROM users`; })).rejects.toThrow(/permission denied/);
    await expect(sql.begin(async (tx) => { await tx`SET LOCAL ROLE authenticated`; await tx`SELECT * FROM user_profiles LIMIT 1`; })).rejects.toThrow(/permission denied/);
    // a table created by a FUTURE migration (that forgets to lock down) must not be exposed either
    await sql`CREATE TABLE future_table (id int)`;
    await expect(sql.begin(async (tx) => { await tx`SET LOCAL ROLE anon`; await tx`SELECT * FROM future_table`; })).rejects.toThrow(/permission denied/);
    await sql`DROP TABLE future_table`;
  });

  it("#21 a deleted user's session token can no longer be used", async () => {
    const dave = await registerUser(sql, { email: "dave@test-data.example", password: "dave's long password" });
    const { token } = await createSession(sql, dave.id);
    expect((await userForSessionToken(sql, token))?.id).toBe(dave.id);
    await deleteMyAccount(sql, dave);
    expect(await userForSessionToken(sql, token)).toBeNull();
    const left = await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${dave.id}`;
    expect(left[0]!.n).toBe(0);
  });

  it("deleting an account removes the user's personal data", async () => {
    const carol = await registerUser(sql, { email: "carol@test-data.example", password: "yet another password" });
    await toggleSaved(sql, carol, oppId);
    await deleteMyAccount(sql, carol);
    const left = await sql`SELECT (SELECT count(*) FROM users WHERE id = ${carol.id})::int + (SELECT count(*) FROM saved_opportunities WHERE user_id = ${carol.id})::int + (SELECT count(*) FROM user_profiles WHERE user_id = ${carol.id})::int AS n`;
    expect(left[0]!.n).toBe(0);
  });
});
