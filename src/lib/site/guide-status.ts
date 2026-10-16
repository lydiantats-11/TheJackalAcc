/**
 * Application status of the programme a guide is about — computed on every request, never frozen
 * (owner approval, 16 Oct 2026).
 *
 * Bug fixed: guide cards showed the status recorded at the 14 Oct manual check ("open") forever, so DiscoverEU
 * still read "Open" after its deadline of 15 Oct 2026, 12:00 Brussels time.
 *
 * Order of evidence:
 *  1. The live public record in the database, through the same availabilityOf() the opportunity pages use,
 *     when it gives a definite answer (open, upcoming, deadline passed, closed).
 *  2. Otherwise the verified period in the checked file, read against the current time.
 *  In both cases a closing date in the past always wins over a recorded "open": a guide never shows a programme
 *  as open after its official deadline.
 *
 * This is the PROGRAMME's application status. It is independent from the guide's own verification status.
 */
import { normaliseDeadline } from "@/lib/domain/deadline";
import type { Availability } from "@/lib/domain/eligibility";
import records from "../../../data/official-records-2026-10-14.v2.json";
import { verifiedFor } from "./verified";

export type ProgrammeStatus = "open" | "rolling" | "upcoming" | "deadline_passed" | "closed" | "unknown";

/** Statuses a visitor can still act on (shown with the positive badge). */
export const ACTIONABLE: ReadonlySet<ProgrammeStatus> = new Set(["open", "rolling"]);

/** The value the checker recorded on 14 Oct (open / rolling / closed / future). Used only as a hint, never alone. */
const RECORDED = new Map(
  (records as { records: Array<{ id: string; application_status: { value: string } }> }).records
    .map((r) => [`manual:${r.id}`, r.application_status.value]),
);

/** A verified date as an instant. A date-only closing date ("2026-05-31") counts as open until the end of that day. */
export function instant(v: string | null, tz: string, endOfDay: boolean): Date | null {
  if (!v) return null;
  const n = normaliseDeadline(v, tz);
  if (!n.closes_at) return null;
  return n.deadline_is_date_only && endOfDay ? new Date(n.closes_at.getTime() + 86_400_000 - 1) : n.closes_at;
}

/** Closing instant of a hand-checked record, or null when it has no fixed deadline. */
export function verifiedCloses(recordKey: string): Date | null {
  const v = verifiedFor(recordKey);
  return v ? instant(v.period.closes, v.period.timezone ?? "Europe/Athens", true) : null;
}

/** Status from the checked file alone, read against `now`. */
export function statusFromVerified(recordKey: string, now: Date): ProgrammeStatus {
  const v = verifiedFor(recordKey);
  if (!v) return "unknown";
  const tz = v.period.timezone ?? "Europe/Athens";
  const closes = instant(v.period.closes, tz, true);
  const opens = instant(v.period.opens, tz, false);
  const recorded = RECORDED.get(recordKey);
  if (recorded === "closed") return "closed";
  if (closes && closes.getTime() < now.getTime()) return "deadline_passed";
  if (opens && opens.getTime() > now.getTime()) return "upcoming";
  if (recorded === "future") return "upcoming";
  if (recorded === "rolling" || !closes) return "rolling";
  return "open";
}

/** The live record's availability in the guide's vocabulary; null when it gives no definite answer (stale, unverified…). */
export function statusFromAvailability(a: Availability, rolling: boolean): ProgrammeStatus | null {
  switch (a) {
    case "open": return rolling ? "rolling" : "open";
    case "upcoming": return "upcoming";
    case "deadline_passed_unconfirmed": return "deadline_passed";
    case "closed": case "closed_budget_exhausted": return "closed";
    default: return null;
  }
}

export interface LiveRecord { availability: Availability; rolling: boolean }

/** The status to show on a guide. */
export function programmeStatus(recordKey: string, now: Date, live?: LiveRecord | null): ProgrammeStatus {
  const fromFile = statusFromVerified(recordKey, now);
  const fromLive = live ? statusFromAvailability(live.availability, live.rolling) : null;
  if (!fromLive) return fromFile;
  // A verified deadline that has passed is never overridden by an "open" answer (an extension needs a new check).
  if (ACTIONABLE.has(fromLive) && fromFile === "deadline_passed") return fromFile;
  return fromLive;
}
