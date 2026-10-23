/**
 * Deadlines that depend on the year a person moved their tax residence to Greece (Articles 5Α and 5Β ΚΦΕ; owner,
 * 23 Oct 2026: «Μην εμφανίζεις μία γενική προθεσμία ως σωστή για όλους»).
 *
 * The rule is recorded once, in data/official-records-corrections-2026-10-22.json (`deadline_rule`), from the 2026
 * decisions (Α.1147/2026 and Α.1192/2026, Article 4(1)):
 *   - moved on or before 2 July of year Y → may apply in Y (year of arrival) or in Y+1;
 *   - moved after 2 July of year Y → may apply for Y+1;
 *   - the application is due by a fixed day of the year of application (30 Sep for 5Α, 31 Oct for 5Β);
 *   - supporting documents may follow until a fixed day of that same year (31 Oct for 5Α, 30 Nov for 5Β).
 * Application windows that closed before the 2026 rules took effect (25 Jun 2026) are shown as «previous rules», never
 * with a date computed from the new rule.
 * Everything here is arithmetic on that rule: no date is written by hand.
 */
import { normaliseDeadline } from "@/lib/domain/deadline";

type L = { el: string; en: string };

export interface MoveYearRule {
  kind: "by_year_of_move";
  /** Last day (MM-DD) of a year that still allows applying in the year of arrival. */
  cutoff: string;
  /** Application due by this day (MM-DD) of the year of application. */
  application_by: string;
  /** Supporting documents may be completed by this day (MM-DD) of the year of application. */
  documents_by: string;
  /** The 2026 rules apply to application windows closing on or after this date (YYYY-MM-DD). */
  rules_in_force_from: string;
  /**
   * Last year of application whose window the official decisions confirm (owner, 23 Oct 2026: a later year that only
   * follows from the rule is «conditional» — never shown as an open, confirmed period or as everyone's next deadline).
   */
  confirmed_through: number;
  timezone: string;
  /** Period of application of the regime once approved. */
  regime: { years: number; start: L | null };
  basis: L;
}

export interface ApplicationWindow {
  year: number;
  /** End of the last day for the application, as an instant. */
  applicationBy: Date;
  documentsBy: Date;
  /** open / passed: confirmed by the decisions · conditional: follows from the rule, not confirmed · previous_rules: before 25 Jun 2026. */
  state: "passed" | "open" | "conditional" | "previous_rules";
}

export interface MoveYearRow {
  moveYear: number;
  /** "by_cutoff" = moved on or before the cutoff day of that year; "after_cutoff" = after it. */
  part: "by_cutoff" | "after_cutoff";
  windows: ApplicationWindow[];
}

/**
 * End of a calendar day in the rule's time zone (date-only deadlines count the whole day): the start of the next day
 * minus 1 ms, so a 25-hour day (end of summer time, e.g. 31 Oct 2027 in Athens) is counted whole.
 */
function endOfDay(isoDate: string, tz: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  const n = normaliseDeadline(next, tz);
  if (!n.closes_at) throw new Error(`bad date ${isoDate}`);
  return new Date(n.closes_at.getTime() - 1);
}

/** The calendar year of an instant in the rule's time zone. */
function yearIn(now: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric" }).format(now));
}

export function applicationWindow(rule: MoveYearRule, year: number, now: Date): ApplicationWindow {
  const applicationBy = endOfDay(`${year}-${rule.application_by}`, rule.timezone);
  const documentsBy = endOfDay(`${year}-${rule.documents_by}`, rule.timezone);
  const inForce = new Date(`${rule.rules_in_force_from}T00:00:00Z`);
  const state = applicationBy.getTime() < inForce.getTime() ? "previous_rules"
    : year > rule.confirmed_through ? "conditional"
    : applicationBy.getTime() < now.getTime() ? "passed" : "open";
  return { year, applicationBy, documentsBy, state };
}

/** Rows for moves last year and this year (in the rule's time zone), each split at the cutoff day. */
export function moveYearRows(rule: MoveYearRule, now: Date): MoveYearRow[] {
  const y0 = yearIn(now, rule.timezone);
  const rows: MoveYearRow[] = [];
  for (const y of [y0 - 1, y0]) {
    rows.push({ moveYear: y, part: "by_cutoff", windows: [applicationWindow(rule, y, now), applicationWindow(rule, y + 1, now)] });
    rows.push({ moveYear: y, part: "after_cutoff", windows: [applicationWindow(rule, y + 1, now)] });
  }
  return rows;
}

/**
 * The earliest CONFIRMED window still open (never a conditional one), or null. It applies only to people who moved in
 * the year before it or by the cutoff day of its own year — never to everyone.
 */
export function confirmedOpenWindow(rule: MoveYearRule, now: Date): ApplicationWindow | null {
  const open = moveYearRows(rule, now).flatMap((r) => r.windows).filter((w) => w.state === "open");
  return open.length ? open.reduce((a, b) => (b.applicationBy.getTime() < a.applicationBy.getTime() ? b : a)) : null;
}

/** The deadline of that confirmed window, or null when no confirmed window is open. */
export function nextDeadline(rule: MoveYearRule, now: Date): Date | null {
  return confirmedOpenWindow(rule, now)?.applicationBy ?? null;
}

/** "2/7" for display. */
export function cutoffLabel(rule: MoveYearRule): string {
  const { day, month } = cutoffDayMonth(rule);
  return `${day}/${month}`;
}

/** "02-07" → day and month for display. */
export function cutoffDayMonth(rule: MoveYearRule): { day: number; month: number } {
  const [m, d] = rule.cutoff.split("-").map(Number);
  return { day: d!, month: m! };
}
