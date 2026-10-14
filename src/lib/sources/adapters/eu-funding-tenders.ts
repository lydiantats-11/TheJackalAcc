/**
 * EU Funding & Tenders Portal connector (grants: call topics).
 *
 * ACCESS STATUS (2026-10-13): the portal's search endpoint is publicly reachable and used by the portal itself,
 * but it has NO official public documentation. Its shape below is taken from independent open-source clients
 * (see SOURCES.md) and has NOT yet been verified live from this project — the build workspace cannot reach it.
 * The parser is therefore defensive: any field it cannot read stays unknown, unknown status codes become
 * "unverified", items without an official URL are skipped (never constructed), and a response whose structure
 * is unrecognisable raises SchemaDriftError so nothing is ingested.
 *
 * Request: POST {endpoint}?apiKey=SEDIA&text=***&pageSize=N&pageNumber=P
 *          multipart parts "query" and "languages", each with Content-Type: application/json.
 * Response: { results: [{ url?, metadata: { <key>: [<value>] } }], totalResults? }  (metadata values are 1-element arrays)
 */
import type { OpportunityStatus } from "@/lib/domain/eligibility";
import {
  SchemaDriftError, stableJson, type AdapterContext, type DiscoveredItem, type DiscoverResult, type SourceAdapter, type SourceConfig,
} from "../types";

export const EU_FT_STATUS: Record<string, OpportunityStatus> = {
  "31094501": "upcoming", // Forthcoming
  "31094502": "open",     // Open for submission
  "31094503": "closed",   // Closed
};

interface EuFtConfig {
  endpoint: string;
  pageSize: number;
  maxPages: number;
  types: string[];
  statuses: string[];
  languages: string[];
}

const DEFAULTS: EuFtConfig = {
  endpoint: "https://api.tech.ec.europa.eu/search-api/prod/rest/search",
  pageSize: 100,
  maxPages: 20,
  types: ["1"],                     // 1 = grant call topics
  statuses: ["31094501", "31094502"], // forthcoming + open; closures are detected when items move to 31094503
  languages: ["en"],
};

/** Metadata values arrive as single-element arrays; some are JSON encoded as strings. */
function first(v: unknown): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" && x.trim() !== "" ? x.trim() : typeof x === "number" ? String(x) : undefined;
}
function all(v: unknown): string[] {
  return (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function isOfficialUrl(u: string | undefined, hosts: string[]): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function buildRequestBody(cfg: EuFtConfig): FormData {
  const query = { bool: { must: [{ terms: { type: cfg.types } }, { terms: { status: cfg.statuses } }] } };
  const fd = new FormData();
  fd.append("query", new Blob([JSON.stringify(query)], { type: "application/json" }), "query.json");
  fd.append("languages", new Blob([JSON.stringify(cfg.languages)], { type: "application/json" }), "languages.json");
  return fd;
}

/** Maps one raw result to a DiscoveredItem, or returns a skip reason. Pure — unit-tested with fixtures. */
export function mapResult(raw: unknown, allowedHosts: string[]): DiscoveredItem | { skip: string; ref?: string } {
  if (!raw || typeof raw !== "object") return { skip: "not_an_object" };
  const r = raw as Record<string, unknown>;
  const m = (r.metadata ?? {}) as Record<string, unknown>;
  const identifier = first(m.identifier) ?? first(m.callIdentifier);
  const title = first(m.title) ?? (typeof r.summary === "string" ? r.summary : undefined);
  if (!identifier) return { skip: "no_identifier" };
  if (!title) return { skip: "no_title", ref: identifier };
  const url = first(m.url) ?? (typeof r.url === "string" ? r.url : undefined);
  if (!isOfficialUrl(url, allowedHosts)) return { skip: "no_official_url", ref: identifier };

  const statusRaw = first(m.status) ?? null;
  const status = statusRaw ? EU_FT_STATUS[statusRaw] ?? null : null;
  const deadlines = all(m.deadlineDate);
  const facts = {
    official_title: title,
    title_lang: "en",
    opportunity_type: "unknown", // a topic may fund grants, prizes or procurement; the action type is not reliably exposed
    publishing_authority: "European Commission (EU Funding & Tenders Portal)",
    programme: first(m.frameworkProgramme) ?? null,
    status,
    status_raw: statusRaw,
    opens_at_raw: first(m.startDate) ?? null,
    deadline_raw: deadlines[0] ?? null,
    additional_deadlines_raw: deadlines.slice(1),
    deadline_timezone: "Europe/Brussels", // the portal publishes deadlines in Brussels time
    application_url: null,
  };
  return {
    canonical_url: url,
    external_key: `eu-topic:${identifier.toUpperCase()}`,
    official_identifier: identifier,
    title,
    source_modified_at: first(m.updateDate) ?? first(m.modificationDate) ?? undefined,
    text: stableJson(facts), // fingerprint of the official structured facts, not of page markup
    document_links: [],
    trust: "official_structured",
    facts,
    // Eligibility conditions are NOT taken from this API: its condition text is unstructured HTML.
    // They will be extracted from the official topic conditions (Phase 3) and reviewed.
    requirements: [],
    raw_metadata: { status_raw: statusRaw, deadlines },
  };
}

export const euFundingTendersAdapter: SourceAdapter = {
  key: "eu-funding-tenders-search",
  version: "0.1.0",
  description: "EU Funding & Tenders Portal search endpoint (undocumented, public). Grants call topics, forthcoming and open.",
  async discover(source: SourceConfig, ctx: AdapterContext): Promise<DiscoverResult> {
    const cfg: EuFtConfig = { ...DEFAULTS, ...(source.config as Partial<EuFtConfig>) };
    cfg.pageSize = Math.min(Math.max(1, cfg.pageSize), 100);
    const items: DiscoveredItem[] = [];
    const skipped: DiscoverResult["skipped"] = [];
    let pages = 0;
    let truncated = false;
    for (let page = 1; page <= cfg.maxPages; page++) {
      const url = `${cfg.endpoint}?apiKey=SEDIA&text=${encodeURIComponent("***")}&pageSize=${cfg.pageSize}&pageNumber=${page}`;
      const res = await ctx.fetch(url, { method: "POST", body: buildRequestBody(cfg), headers: { accept: "application/json" } });
      pages++;
      let json: unknown;
      try {
        json = JSON.parse(res.body.toString("utf8"));
      } catch {
        throw new SchemaDriftError("response is not JSON");
      }
      const results = (json as { results?: unknown }).results;
      if (!Array.isArray(results)) throw new SchemaDriftError("response has no results array");
      let parsedOnPage = 0;
      for (const raw of results) {
        const mapped = mapResult(raw, source.allowed_hosts);
        if ("skip" in mapped) skipped.push({ reason: mapped.skip, ref: mapped.ref });
        else { items.push(mapped); parsedOnPage++; }
      }
      if (results.length > 0 && parsedOnPage === 0 && skipped.every((s) => s.reason === "no_identifier" || s.reason === "not_an_object"))
        throw new SchemaDriftError("no result on the page had a recognisable identifier");
      const total = Number((json as { totalResults?: unknown }).totalResults);
      if (results.length < cfg.pageSize || (Number.isFinite(total) && page * cfg.pageSize >= total)) break;
      if (page === cfg.maxPages) truncated = true;
    }
    // Deduplicate within the run (the same topic can appear on two pages if the index shifts between requests).
    const seen = new Map<string, DiscoveredItem>();
    for (const it of items) seen.set(it.external_key ?? it.canonical_url, it);
    ctx.log("eu-ft discover finished", { pages, items: seen.size, skipped: skipped.length, truncated });
    return { items: [...seen.values()], skipped, pages_fetched: pages, truncated };
  },
};
