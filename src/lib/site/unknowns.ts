/**
 * «Τι δεν γνωρίζουμε ακόμη» — what the platform does NOT know about a listing, derived only from recorded facts
 * (sprint 17 Oct 2026, Priority 0). Deterministic and server-free so it can be tested; it never adds a fact.
 */
import type { RecordStatus } from "@/lib/domain/record-status";
import type { ApplicantAudience } from "./applicants";

export type Unknown =
  | "recheck" | "conflict" | "requirementsIncomplete" | "deadlineUnknown" | "amountUnknown" | "applicantUnknown" | "documentsUnreviewed";

export interface UnknownInput {
  record: Pick<RecordStatus, "display" | "freshness">;
  hasConflict: boolean;
  completeness: string | null;
  deadlineKind: string | null;
  hasDeadline: boolean;
  amountState: string | null;
  applicant: ApplicantAudience;
  /** Owner-approved document list exists for this record (none yet: lists are pending approval). */
  documentsApproved: boolean;
}

export function unknownsOf(x: UnknownInput): Unknown[] {
  const out: Unknown[] = [];
  if (x.record.display === "recheck" || x.record.freshness === "recheck" || x.record.freshness === "unverified") out.push("recheck");
  if (x.hasConflict || x.record.freshness === "conflicting") out.push("conflict");
  if (x.completeness !== "complete") out.push("requirementsIncomplete");
  if (!(x.deadlineKind === "rolling" || x.deadlineKind === "not_applicable" || (x.deadlineKind === "official" && x.hasDeadline))) out.push("deadlineUnknown");
  if (x.amountState !== "known" && x.amountState !== "not_applicable") out.push("amountUnknown");
  if (x.applicant === "unknown") out.push("applicantUnknown");
  if (!x.documentsApproved) out.push("documentsUnreviewed");
  return out;
}
