/**
 * The signed-in person's decision record for one opportunity, as JSON (core capability 2: auditable decisions).
 * Contains their own answers that the rules read, so it is private: login required, never cached.
 */
import { currentUser } from "@/lib/auth/session";
import { getOpportunity, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { getProfile } from "@/lib/data/user";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { buildDecisionRecord } from "@/lib/domain/decision-record";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return Response.json({ error: "no_database" }, { status: 503 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const o = await getOpportunity(sql(), id);
  if (!o) return Response.json({ error: "not_found" }, { status: 404 });
  const [profile, reqs] = await Promise.all([getProfile(sql(), user), loadRequirements(sql(), [o.id])]);
  const record = buildDecisionRecord(toMatchable(o, reqs.get(o.id) ?? []), profile);
  const body = {
    ...record,
    opportunity: { title: o.official_title, official_url: o.canonical_url, last_verified_at: o.last_verified_at },
    notice: "Preliminary screening by Jackal Accountant from official sources. Not a decision of the responsible authority.",
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="decision-${record.reference}.json"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
