/**
 * Application status shown on guides — the SAME canonical status as every other page (record-status.ts).
 *
 * History: 16 Oct 2026 the frozen 14 Oct snapshot was replaced by a computed status. 17 Oct 2026 (Milestone 1) the
 * guides were moved onto the canonical model so that a guide and its listing can never disagree: when the database
 * record is past its re-check interval, the guide shows «Χρειάζεται νέος έλεγχος» with the last verified status and
 * date, exactly like the listing (before, the guide fell back to the checked file and said "open").
 *
 * Order of evidence:
 *  1. The live public record in the database (canonical status of that record).
 *  2. Without a database: the hand-checked file, turned into the same input (status, dates, last verification date,
 *     re-check interval) and passed through the same canonical function.
 *  A verified closing time that has passed always wins over an open/awaiting answer (an extension needs a new check).
 * This is the PROGRAMME's application status. It is independent from the guide's own content-verification state.
 */
import { normaliseDeadline } from "@/lib/domain/deadline";
import { recordStatus, type ApplicationStatus, type DisplayStatus, type RecordStatus } from "@/lib/domain/record-status";
import { CHECKED_RECORDS as records } from "./checked-records";
import { verifiedFor } from "./verified";

export type ProgrammeStatus = DisplayStatus | "unknown";
export interface GuideRecordStatus { display: ProgrammeStatus; application: ApplicationStatus | "unknown"; lastVerifiedAt: Date | null }

const UNKNOWN: GuideRecordStatus = { display: "unknown", application: "unknown", lastVerifiedAt: null };

interface RawStatus { value: string; verified_on?: string; stale_after_days?: number }
const RAW = new Map(
  (records as unknown as { records: Array<{ id: string; application_status: RawStatus }> }).records.map((r) => [`manual:${r.id}`, r.application_status]),
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

/** Canonical status of a hand-checked record from the checked file alone (same rules as the database import). */
export function statusFromVerified(recordKey: string, now: Date): GuideRecordStatus {
  const v = verifiedFor(recordKey);
  const raw = RAW.get(recordKey);
  if (!v || !raw) return UNKNOWN;
  const tz = v.period.timezone ?? "Europe/Athens";
  const closes = instant(v.period.closes, tz, true);
  const opens = instant(v.period.opens, tz, false);
  // «unconfirmed»: the official page does not confirm the round (owner, 22 Oct 2026: «Υπό επιβεβαίωση»).
  const status = raw.value === "closed" ? "closed" : raw.value === "unconfirmed" ? "unverified" : raw.value === "future" || (opens && opens > now) ? "upcoming" : "open";
  const r = recordStatus({
    status,
    closes_at: closes,
    deadline_kind: closes ? "official" : raw.value === "rolling" ? "rolling" : "not_announced",
    // the database import stores the check date as midnight Athens time (db/seed/official-records-2026-10-14.sql)
    last_verified_at: new Date(`${raw.verified_on ?? v.checkedOn}T00:00:00+03:00`),
    stale_after_hours: (raw.stale_after_days ?? 30) * 24,
    has_conflict: false,
    budget_exhausted: "no",
  } as Parameters<typeof recordStatus>[0], now);
  return { display: r.display, application: r.application, lastVerifiedAt: r.lastVerifiedAt };
}

export type LiveRecord = RecordStatus;

/** The status to show on a guide. */
export function programmeStatus(recordKey: string, now: Date, live?: LiveRecord | null): GuideRecordStatus {
  if (!live) return statusFromVerified(recordKey, now);
  const closes = verifiedCloses(recordKey);
  if (closes && closes.getTime() < now.getTime() && live.application !== "closed") {
    return { display: "deadline_passed", application: "deadline_passed", lastVerifiedAt: live.lastVerifiedAt };
  }
  return { display: live.display, application: live.application, lastVerifiedAt: live.lastVerifiedAt };
}
