import type { OpportunityStatus } from "./eligibility";

/** Allowed status transitions. Anything else must go through an admin correction (audited). */
export const TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  discovered: ["under_review", "unverified", "upcoming", "open", "closed", "cancelled"],
  under_review: ["upcoming", "open", "closed", "cancelled", "unverified"],
  upcoming: ["open", "suspended", "cancelled", "unverified"],
  open: ["extended", "suspended", "closed", "cancelled", "unverified"],
  extended: ["extended", "suspended", "closed", "cancelled", "unverified"],
  suspended: ["open", "extended", "closed", "cancelled", "unverified"],
  closed: ["extended", "open", "archived", "unverified"], // reopened calls / extensions published after closing
  cancelled: ["archived"],
  archived: [],
  unverified: ["upcoming", "open", "extended", "suspended", "closed", "cancelled", "archived"],
};

export function canTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type RecheckResult =
  | { kind: "source_unavailable" }
  | { kind: "confirmed_closed"; evidenceUrl: string }
  | { kind: "deadline_extended"; newClosesAt: Date; evidenceUrl: string }
  | { kind: "no_change_found" };

export interface StatusDecision {
  status: OpportunityStatus;
  closes_at: Date | null;
  reason: string;
}

/**
 * Decides an opportunity's status once its published deadline has passed.
 * A source outage NEVER closes an opportunity — it only marks the status as needing verification.
 */
export function statusAfterDeadline(
  current: { status: OpportunityStatus; closes_at: Date | null },
  recheck: RecheckResult,
): StatusDecision {
  switch (recheck.kind) {
    case "source_unavailable":
      return { status: "unverified", closes_at: current.closes_at, reason: "deadline_passed_source_unavailable" };
    case "confirmed_closed":
      return { status: "closed", closes_at: current.closes_at, reason: "deadline_passed_confirmed_by_source" };
    case "deadline_extended":
      return { status: "extended", closes_at: recheck.newClosesAt, reason: "deadline_extended_by_source" };
    case "no_change_found":
      // The page is reachable and still shows the old deadline with no closure notice: we still cannot be sure.
      return { status: "unverified", closes_at: current.closes_at, reason: "deadline_passed_not_confirmed" };
  }
}
