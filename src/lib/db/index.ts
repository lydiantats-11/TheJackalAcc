import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

/** Shared connection pool (reused across hot reloads in dev). Server-only. */
export function sql(): postgres.Sql {
  if (!globalThis.__sql) {
    globalThis.__sql = postgres(requireDatabaseUrl(), {
      max: 5,
      idle_timeout: 20,
      prepare: false, // compatible with Supabase transaction pooler
      onnotice: () => {},
    });
  }
  return globalThis.__sql;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
