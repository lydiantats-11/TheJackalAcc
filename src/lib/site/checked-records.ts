/**
 * The hand-checked official records as they stand today: the file checked on 14 Oct 2026 (v2, kept unchanged) with the
 * corrections approved by the owner on 22 Oct 2026 (data/official-records-corrections-2026-10-22.json) applied on top.
 * A correction replaces whole named fields (application status, official sources, application steps, notes) — it never edits a value in place,
 * so what was checked on 14 Oct and what changed on 22 Oct both stay on record.
 */
import base from "../../../data/official-records-2026-10-14.v2.json";
import fixes from "../../../data/official-records-corrections-2026-10-22.json";

type Raw = (typeof base)["records"][number] & Record<string, unknown>;
type Source = { label: string; url: string; checked_on: string };
interface Fix {
  application_status?: Record<string, unknown>;
  official_sources?: Source[];
  official_sources_add?: Source[];
  application_steps?: Record<string, string[]>;
  uncertainties?: string[];
}

const FIXES = (fixes as { records: Record<string, Fix> }).records;

export const CORRECTED_IDS: ReadonlySet<string> = new Set(Object.keys(FIXES));

function apply(r: Raw): Raw {
  const f = FIXES[r.id];
  if (!f) return r;
  const sources = f.official_sources ?? [...((r.official_sources as Source[] | undefined) ?? []), ...(f.official_sources_add ?? [])];
  return {
    ...r,
    ...(f.application_status ? { application_status: f.application_status } : {}),
    ...(f.application_steps ? { application_steps: f.application_steps } : {}),
    ...(f.uncertainties ? { uncertainties: f.uncertainties } : {}),
    official_sources: sources,
  } as Raw;
}

export const CHECKED_RECORDS = {
  ...base,
  records: (base.records as Raw[]).map(apply),
};
