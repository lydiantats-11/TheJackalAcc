import type { Dictionary } from "@/lib/i18n/dictionaries";

const STATUS_TONE: Record<string, string> = {
  open: "b-ok", extended: "b-ok", upcoming: "b-info", suspended: "b-warn", unverified: "b-warn",
  discovered: "b-warn", under_review: "b-warn", closed: "", cancelled: "b-bad", archived: "",
};
const ELIG_TONE: Record<string, string> = {
  potentially_eligible: "b-ok", potentially_eligible_verification_required: "b-info", insufficient_information: "",
  under_review: "b-warn", unlikely_eligible: "b-bad", ineligible_verified: "b-bad", not_assessed: "",
};
const AVAIL_TONE: Record<string, string> = {
  open: "b-ok", upcoming: "b-info", suspended: "b-warn", closed: "", closed_budget_exhausted: "",
  deadline_passed_unconfirmed: "b-warn", unverified: "b-warn", stale: "b-warn", conflicting_information: "b-bad",
};
const STATE_TONE: Record<string, string> = {
  satisfied: "b-ok", not_satisfied: "b-bad", unknown: "b-info", not_applicable: "", conflicting: "b-warn", needs_review: "b-warn",
};

export function StatusBadge({ status, t }: { status: string; t: Dictionary }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ""}`}>{t.status[status] ?? status}</span>;
}
export function EligibilityBadge({ status, t, hypothetical }: { status: string; t: Dictionary; hypothetical?: boolean }) {
  return <span className={`badge ${ELIG_TONE[status] ?? ""}`}>{hypothetical ? "⟡ " : ""}{t.elig[status] ?? status}</span>;
}
export function AvailabilityBadge({ value, t }: { value: string; t: Dictionary }) {
  return <span className={`badge ${AVAIL_TONE[value] ?? ""}`}>{t.availability[value] ?? value}</span>;
}
export function StateBadge({ state, t }: { state: string; t: Dictionary }) {
  return <span className={`badge ${STATE_TONE[state] ?? ""}`}>{t.state[state] ?? state}</span>;
}
export function SyntheticLabel({ t }: { t: Dictionary }) {
  return <span className="synthetic">{t.synthetic}</span>;
}
