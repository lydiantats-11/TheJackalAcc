/** Live public records behind the programme guides (server only). Absent database → empty map, guides use the checked file. */
import "server-only";
import { getOpportunity, toMatchable } from "@/lib/data/opportunities";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { recordStatus } from "@/lib/domain/record-status";
import type { LiveRecord } from "./guide-status";

export type LiveGuideRecord = LiveRecord & { id: string };

export async function loadLiveGuideRecords(keys: string[], now = new Date()): Promise<Map<string, LiveGuideRecord>> {
  const out = new Map<string, LiveGuideRecord>();
  if (!isDatabaseConfigured() || keys.length === 0) return out;
  try {
    const db = sql();
    const ids = await db<{ id: string; external_key: string }[]>`
      SELECT id, external_key FROM opportunities
      WHERE external_key = ANY(${keys}) AND review_status = 'approved' AND merged_into_id IS NULL`;
    for (const { id, external_key } of ids) {
      const row = await getOpportunity(db, id);
      if (!row) continue;
      out.set(external_key, { id, ...recordStatus(toMatchable(row, []), now) });
    }
  } catch {
    // Database unreachable: the guides fall back to the checked file, which is still read against today's date.
  }
  return out;
}
