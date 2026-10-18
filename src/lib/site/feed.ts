/**
 * «Νέα για εσάς» (18 Oct 2026): what a visitor should see first so they can apply early.
 *  - opened:   the OFFICIAL opening date is within the last 21 days and the record is open or upcoming and fresh
 *              (records due a re-check stay in the listings, but are not announced as news);
 *  - closing:  open with an official deadline within the next 14 days;
 *  - changed:  a recorded change (extension, amendment, status change, official details changed) in the last 14 days.
 * Import dates are never used as "new": a batch import is not news. Server-free so it can be tested.
 */
import type { ListedOpportunity } from "./listing";

const DAY = 86_400_000;
export const OPENED_WINDOW_DAYS = 21;
export const CLOSING_WINDOW_DAYS = 14;
export const CHANGED_WINDOW_DAYS = 14;
export const NEWS_KINDS = new Set(["extension", "amendment", "corrigendum", "status", "official_details_changed"]);

export interface RecentChange { opportunity_id: string; at: Date; kind: string }
export type FeedItem<T> = { kind: "opened" | "closing" | "changed"; at: Date; item: T; change?: string };

type Feedable = Pick<ListedOpportunity, "record" | "status"> & { row: Pick<ListedOpportunity["row"], "id" | "opens_at" | "closes_at" | "deadline_kind"> };

export function buildFeed<T extends Feedable>(items: T[], changes: RecentChange[], now: Date) {
  const opened: FeedItem<T>[] = [];
  const closing: FeedItem<T>[] = [];
  const changed: FeedItem<T>[] = [];
  const byId = new Map(items.map((x) => [x.row.id, x]));
  for (const x of items) {
    const o = x.row;
    if (o.opens_at && (x.status === "open" || x.status === "upcoming") && o.opens_at.getTime() <= now.getTime() && now.getTime() - o.opens_at.getTime() <= OPENED_WINDOW_DAYS * DAY) {
      opened.push({ kind: "opened", at: o.opens_at, item: x });
    }
    if (x.status === "open" && o.deadline_kind === "official" && o.closes_at && o.closes_at.getTime() > now.getTime() && o.closes_at.getTime() - now.getTime() <= CLOSING_WINDOW_DAYS * DAY) {
      closing.push({ kind: "closing", at: o.closes_at, item: x });
    }
  }
  const seen = new Set<string>();
  for (const c of [...changes].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const x = byId.get(c.opportunity_id);
    if (!x || seen.has(c.opportunity_id) || !NEWS_KINDS.has(c.kind) || now.getTime() - c.at.getTime() > CHANGED_WINDOW_DAYS * DAY) continue;
    seen.add(c.opportunity_id);
    changed.push({ kind: "changed", at: c.at, item: x, change: c.kind });
  }
  opened.sort((a, b) => b.at.getTime() - a.at.getTime());
  closing.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { opened, closing, changed, total: opened.length + closing.length + changed.length };
}
