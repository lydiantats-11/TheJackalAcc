/**
 * The concrete brief of an opportunity (18 Oct 2026): how much time is left and what to do now, derived ONLY from the
 * recorded dates and the canonical status. Server-free so it can be tested. Never adds a fact: when a date is not
 * recorded the brief says so.
 */
import type { RecordStatus } from "@/lib/domain/record-status";

const DAY = 86_400_000;

export type TimeLeft =
  | { kind: "days_left"; days: number; urgent: boolean; until: Date; next?: boolean }
  | { kind: "last_day"; until: Date; next?: boolean }
  | { kind: "opens_in"; days: number; on: Date }
  | { kind: "rolling" }
  | { kind: "no_deadline_recorded" }
  | { kind: "check_status" }
  | { kind: "passed" }
  | { kind: "closed" };

export type NextAction = "apply_now" | "read_guide_then_apply" | "prepare" | "confirm_status" | "see_similar";

export interface BriefInput {
  record: Pick<RecordStatus, "display" | "application">;
  closesAt: Date | null;
  opensAt: Date | null;
  deadlineKind: string | null;
  hasGuide: boolean;
  /** The deadline depends on the year of move (5Α, 5Β): closesAt is the next one, not everyone's (owner, 23 Oct 2026). */
  moveYear?: boolean;
}

/** Whole days left until the deadline (rounded up), counted against `now`. */
export function daysUntil(at: Date, now: Date): number {
  return Math.ceil((at.getTime() - now.getTime()) / DAY);
}

export function timeLeftOf(x: BriefInput, now: Date): TimeLeft {
  const d = x.record.display;
  if (d === "closed" || d === "suspended") return { kind: "closed" };
  if (d === "deadline_passed") return { kind: "passed" };
  if (d === "recheck" || d === "unverified" || d === "conflicting") return { kind: "check_status" };
  if (d === "upcoming") {
    if (x.opensAt && x.opensAt.getTime() > now.getTime()) return { kind: "opens_in", days: daysUntil(x.opensAt, now), on: x.opensAt };
    return { kind: "check_status" };
  }
  if (d === "rolling" || x.deadlineKind === "rolling") return { kind: "rolling" };
  if (x.deadlineKind === "official" && x.closesAt) {
    const days = daysUntil(x.closesAt, now);
    const next = x.moveYear ? { next: true } : {};
    if (days <= 1) return { kind: "last_day", until: x.closesAt, ...next };
    return { kind: "days_left", days, urgent: days <= 7, until: x.closesAt, ...next };
  }
  return { kind: "no_deadline_recorded" };
}

export function nextActionOf(x: BriefInput, now: Date): NextAction {
  const t = timeLeftOf(x, now);
  switch (t.kind) {
    case "closed": case "passed": return "see_similar";
    case "check_status": return "confirm_status";
    case "opens_in": return "prepare";
    default: return x.hasGuide ? "read_guide_then_apply" : "apply_now";
  }
}

/**
 * An application call-to-action («Επίσημη αίτηση») is offered only while applications may be accepted: never after the
 * official deadline, never for a closed or suspended programme (owner, 22 Oct 2026). The official page stays linked as
 * information. A programme whose status is pending confirmation («Υπό επιβεβαίωση») or contradicted by another official
 * source gets no application button either (owner, 22 Oct 2026, Phase 1): only the official page, as information.
 */
export function applicationCtaAllowed(application: string | null | undefined, display?: string | null): boolean {
  if (display === "unverified" || display === "conflicting") return false;
  return application !== "closed" && application !== "deadline_passed" && application !== "suspended";
}
