import { createHash } from "node:crypto";
import type { FetchedResource, FetchPolicy, SafeRequestInit } from "./fetcher";
import type { OpportunityStatus } from "@/lib/domain/eligibility";
import type { RequirementRecord } from "@/lib/domain/engine/requirement";

export type SourceLifecycle = "configured" | "tested" | "active" | "degraded" | "inactive";

export interface SourceConfig {
  id: string;
  slug: string;
  name: string;
  authority: string;
  base_url: string;
  allowed_hosts: string[];
  access_method: "api" | "rss" | "sitemap" | "html" | "document" | "manual";
  adapter: string;
  config: Record<string, unknown>;
  lifecycle: SourceLifecycle;
  enabled: boolean;
}

/** Facts an adapter read from STRUCTURED official data. Anything it could not read is left undefined/null. */
export interface NormalisedFacts {
  official_title: string;
  title_lang: string;
  opportunity_type: string; // "unknown" when the source does not say
  publishing_authority: string | null;
  programme?: string | null;
  /** null = the source gave a status value we do not recognise → stored as "unverified". */
  status: OpportunityStatus | null;
  status_raw?: string | null;
  opens_at_raw?: string | null;
  deadline_raw?: string | null;
  additional_deadlines_raw?: string[];
  deadline_timezone: string;
  /** The source labels local wall-clock times as UTC (see DeadlineReading in domain/deadline.ts). */
  deadline_utc_label_is_local?: boolean;
  application_url?: string | null;
}

/**
 * Official details a source publishes in structured form, shown to users as-is (never used for eligibility).
 * Kept apart from NormalisedFacts so they can refresh on every run without counting as a change to the call.
 * Every field is optional: absent = the source did not publish it.
 */
export interface OfficialDetails {
  source: string;
  /** Set by the pipeline when written. */
  retrieved_at?: string;
  /** Total budget of the topic, in euro, as published (sum over the topic's actions), and per budget year. */
  budget?: { total_eur: number; by_year: Record<string, number>; expected_grants: number | null; min_grant_eur: number | null; max_grant_eur: number | null } | null;
  action_type?: string | null;
  /** e.g. "single-stage", "two-stage" (as published). */
  submission?: string | null;
  call?: { identifier: string; title: string | null } | null;
  planned_opening?: string | null;
  /** Official text, in the source's language, shortened at a sentence boundary. */
  scope_excerpt?: { text: string; lang: string; truncated: boolean } | null;
  /** Condition headings and their short official text (e.g. "Eligible countries: described in section 6 of the call document"). */
  conditions?: { heading: string; text: string }[];
  /** Official documents linked from the conditions (call document, work programme…). */
  documents?: { label: string; url: string }[];
}

/** One candidate item found on a source. All content is UNTRUSTED data — never instructions. */
export interface DiscoveredItem {
  canonical_url: string;
  /** Cross-source identity, e.g. "eu-topic:HORIZON-CL5-2027-D3-01". Enables duplicate detection across sources. */
  external_key?: string;
  official_identifier?: string;
  title: string;
  published_on?: string;
  /** Newest timestamp the source attaches to this item, if any (guards against stale re-application). */
  source_modified_at?: string;
  text: string;
  document_links: string[];
  trust: "official_structured" | "official_page";
  facts?: NormalisedFacts;
  requirements?: Omit<RequirementRecord, "id" | "version">[];
  raw_metadata?: Record<string, unknown>;
  /** Official structured details for display; undefined = this adapter does not provide them (existing values kept). */
  details?: OfficialDetails;
}

export interface DiscoverResult {
  items: DiscoveredItem[];
  /** Items the adapter saw but refused to emit, with a reason (e.g. missing official URL). */
  skipped: { reason: string; ref?: string }[];
  pages_fetched: number;
  truncated: boolean;
}

export interface AdapterContext {
  fetch: (url: string, init?: SafeRequestInit) => Promise<FetchedResource>;
  policy: FetchPolicy;
  log: (msg: string, data?: Record<string, unknown>) => void;
}

export interface SourceAdapter {
  key: string;
  version: string;
  description: string;
  discover(source: SourceConfig, ctx: AdapterContext): Promise<DiscoverResult>;
}

/** Raised when a source's response no longer has the structure the adapter understands. Nothing is ingested. */
export class SchemaDriftError extends Error {}

export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(p)) u.searchParams.delete(p);
  u.searchParams.sort();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export function contentFingerprint(text: string): string {
  const normalised = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalised).digest("hex");
}

/** Deterministic JSON (sorted keys) so the same facts always produce the same fingerprint. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
