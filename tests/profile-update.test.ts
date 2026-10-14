import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { freshDatabase, TEST_DB_URL } from "./db-helper";
import { registerUser, type SessionUser } from "@/lib/auth/service";
import { getProfile, updateProfile } from "@/lib/data/user";

describe.skipIf(!TEST_DB_URL)("profile saves never erase unrelated answers (PostgreSQL)", () => {
  let sql: postgres.Sql;
  let u: SessionUser;

  beforeAll(async () => {
    sql = await freshDatabase();
    u = await registerUser(sql, { email: "patch@test-data.example", password: "a long test password" });
  });
  afterAll(async () => { await sql?.end(); });

  it("writes only the fields that were sent", async () => {
    await updateProfile(sql, u, {
      personas: ["household", "young_adult"], interests: ["housing"], housing_status: "renting",
      household_income_range: "prefer_not", age_range: "25_29", tax_residence_country: "ES",
    });
    // A later save from a form that showed only the work section
    await updateProfile(sql, u, { employment_status: "unemployed", dypa_registered: "not_sure" });
    const p = await getProfile(sql, u);
    expect(p.employment_status).toBe("unemployed");
    expect(p.housing_status).toBe("renting");
    expect(p.household_income_range).toBe("prefer_not");
    expect(p.tax_residence_country).toBe("ES");
    expect(p.personas).toEqual(["household", "young_adult"]);
  });

  it("switching personas off keeps the answers given under them", async () => {
    await updateProfile(sql, u, { personas: [] });
    const p = await getProfile(sql, u);
    expect(p.personas).toEqual([]); // an explicit empty choice, distinct from never asked (null)
    expect(p.housing_status).toBe("renting");
  });

  it("a field sent as null is cleared; a field not sent is not", async () => {
    await updateProfile(sql, u, { housing_status: null });
    const p = await getProfile(sql, u);
    expect(p.housing_status).toBeNull();
    expect(p.age_range).toBe("25_29");
  });

  it("keeps 'not sure' and 'prefer not to answer' distinct from 'not asked'", async () => {
    const p = await getProfile(sql, u);
    expect(p.dypa_registered).toBe("not_sure");
    expect(p.household_income_range).toBe("prefer_not");
    expect(p.first_home_purchase).toBeNull();
  });

  it("rejects unknown personas instead of storing them", async () => {
    await expect(updateProfile(sql, u, { personas: ["wizard"] })).rejects.toThrow();
  });
});
