/**
 * Deadline normalisation. Preserves the original wording and timezone.
 * A date-only deadline is stored as the START of that day in the source's timezone (the earliest moment it
 * could end), flagged date-only, so the platform never tells someone they still have time when they might not.
 */
export interface NormalisedDeadline {
  closes_at: Date | null;
  deadline_kind: "official" | "not_announced";
  deadline_is_date_only: boolean;
  deadline_original_text: string | null;
  deadline_timezone: string;
}

/** Offset in minutes of `tz` at instant `at` (e.g. Europe/Athens → +180 in summer). */
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export function normaliseDeadline(raw: string | null | undefined, sourceTimezone: string): NormalisedDeadline {
  const none: NormalisedDeadline = { closes_at: null, deadline_kind: "not_announced", deadline_is_date_only: false, deadline_original_text: raw ?? null, deadline_timezone: sourceTimezone };
  if (!raw || !raw.trim()) return none;
  const s = raw.trim();
  // Full timestamp with explicit offset or Z → exact instant.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? none : { ...none, closes_at: d, deadline_kind: "official" };
  }
  // Local timestamp without offset → interpret in the SOURCE's timezone (never the user's).
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const [, y, mo, d, h, mi, se] = local.map((x) => (x === undefined ? 0 : Number(x))) as number[];
    const guess = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, se!));
    const off = tzOffsetMinutes(sourceTimezone, guess);
    return { ...none, closes_at: new Date(guess.getTime() - off * 60_000), deadline_kind: "official" };
  }
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly.map(Number) as number[];
    const guess = new Date(Date.UTC(y!, mo! - 1, d!, 0, 0, 0));
    const off = tzOffsetMinutes(sourceTimezone, guess);
    return { ...none, closes_at: new Date(guess.getTime() - off * 60_000), deadline_kind: "official", deadline_is_date_only: true };
  }
  return none; // unparseable wording stays "not announced" with the original text preserved for human review
}
