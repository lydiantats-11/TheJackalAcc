import { isDatabaseConfigured, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Exposes no internal details. */
export async function GET() {
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  if (isDatabaseConfigured()) {
    try {
      await sql()`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }
  return Response.json({ status: database === "ok" ? "ok" : "degraded", database }, { status: database === "ok" ? 200 : 503 });
}
