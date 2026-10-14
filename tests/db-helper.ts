import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

/**
 * Fresh schema per test file. Simulates Supabase: roles anon/authenticated exist and, BEFORE our migrations run,
 * receive Supabase-style default grants on everything created in `public`. Our migrations must take those away.
 * Never point TEST_DATABASE_URL at a real database.
 */
export async function freshDatabase(): Promise<postgres.Sql> {
  const sql = postgres(TEST_DB_URL!, { max: 6, onnotice: () => {} });
  await sql.unsafe(`
    DROP SCHEMA public CASCADE; CREATE SCHEMA public;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;`);
  await sql`CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const dir = path.join(process.cwd(), "db", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await sql.unsafe(readFileSync(path.join(dir, f), "utf8"));
  return sql;
}
