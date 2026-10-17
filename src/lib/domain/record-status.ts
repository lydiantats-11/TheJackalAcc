/**
 * Canonical status of an opportunity record for everything a visitor sees (Milestone 1, 17 Oct 2026).
 *
 * Two separate questions, never merged:
 *  - application status: what the official evidence last said about applying (open, rolling, upcoming, deadline
 *    passed, closed, suspended) — dates are read against the current time;
 *  - freshness: whether that evidence is still within its re-check interval (current), past it (recheck),
 *    never verified (unverified) or contradicted by another official source (conflicting).
 *
 * Display rule (one rule, used by home, categories, listings, detail pages, matches and guides):
 *  - a passed deadline, a closure or a suspension is shown as such, whatever the freshness (it does not depend on
 *    re-checking; dates are facts);
 *  - otherwise conflicting / unverified evidence is shown as such;
 *  - otherwise evidence past its re-check interval is shown as «Χρειάζεται νέος έλεγχος» together with the last
 *    verified status and date — never as plainly open, and never as closed;
 *  - otherwise the application status itself.
 * The eligibility engine (availabilityOf, assess) is unchanged; this module only decides what is displayed.
 */
import type { OpportunityForMatching } from "./eligibility";

export type ApplicationStatus = "open" | "rolling" | "upcoming" | "deadline_passed" | "closed" | "suspended";
export type Freshness = "current" | "recheck" | "unverified" | "conflicting";
export type DisplayStatus = ApplicationStatus | "recheck" | "unverified" | "conflicting";

export interface RecordStatus {
  application: ApplicationStatus;
  freshness: Freshness;
  display: DisplayStatus;
  lastVerifiedAt: Date | null;
}

type Input = Pick<OpportunityForMatching, "status" | "closes_at" | "deadline_kind" | "last_verified_at" | "stale_after_hours" | "has_conflict" | "budget_exhausted">;

const CLOSED = new Set(["closed", "cancelled", "archived"]);
const UNVERIFIED = new Set(["discovered", "under_review", "unverified"]);

export function applicationStatusOf(o: Input, now: Date): ApplicationStatus {
  if (CLOSED.has(o.status)) return "closed";
  if (o.deadline_kind === "official" && o.closes_at && o.closes_at.getTime() < now.getTime()) return "deadline_passed";
  if (o.status === "suspended") return "suspended";
  if (o.status === "upcoming") return "upcoming";
  return o.deadline_kind === "rolling" ? "rolling" : "open";
}

export function freshnessOf(o: Input, now: Date): Freshness {
  if (o.has_conflict) return "conflicting";
  if (UNVERIFIED.has(o.status)) return "unverified";
  const staleMs = (o.stale_after_hours ?? 72) * 3_600_000;
  if (!o.last_verified_at) return "unverified";
  return now.getTime() - o.last_verified_at.getTime() > staleMs ? "recheck" : "current";
}

export function recordStatus(o: Input, now: Date): RecordStatus {
  const application = applicationStatusOf(o, now);
  const freshness = freshnessOf(o, now);
  let display: DisplayStatus = application;
  if (application === "open" || application === "rolling" || application === "upcoming") {
    if (freshness !== "current") display = freshness;
  } else if (application === "closed" && freshness === "conflicting") {
    display = "conflicting";
  }
  return { application, freshness, display, lastVerifiedAt: o.last_verified_at };
}

/** Records a visitor should see by default: open, rolling, upcoming, and those awaiting a re-check of those. */
export function isCurrent(r: RecordStatus): boolean {
  return r.application === "open" || r.application === "rolling" || r.application === "upcoming";
}

/** Shown with the positive (green) tone: only verified, current open or rolling records. */
export function isConfirmedOpen(r: RecordStatus): boolean {
  return r.display === "open" || r.display === "rolling";
}
