/** Browsing groups for lists (no server dependencies, so tests and client code can use it). */
import type { RecordStatus } from "@/lib/domain/record-status";

export type StatusGroup = "open" | "upcoming" | "recheck" | "passed" | "closed" | "other";

/** Browsing group from the canonical status. Records past their re-check interval stay visible as "recheck". */
export function statusGroup(r: RecordStatus): StatusGroup {
  if (r.display === "open" || r.display === "rolling") return "open";
  if (r.display === "upcoming") return "upcoming";
  if (r.display === "recheck") return "recheck";
  if (r.application === "deadline_passed") return "passed";
  if (r.application === "closed") return "closed";
  return "other";
}
