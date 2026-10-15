/**
 * Official details of an EU Funding & Tenders topic, read from the search API's own structured fields
 * (measured 15 Oct 2026, scripts/eu-ft-details-probe.ts): budgetOverview, typesOfAction, deadlineModel, callIdentifier,
 * callTitle, startDate, descriptionByte (HTML), topicConditions (HTML).
 *
 * Rules: nothing is inferred. A value the portal leaves at 0 or empty (e.g. minContribution 0) is "not published",
 * not zero. HTML is reduced to plain text (it is untrusted and only ever rendered as text). Links are kept only when
 * they are https on an allowed official host. Pure — unit-tested with fixtures.
 */
import type { OfficialDetails } from "../types";

const SCOPE_MAX = 700;
const CONDITIONS_MAX = 10;
const CONDITION_TEXT_MAX = 300;

function str(v: unknown): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" && x.trim() !== "" ? x.trim() : undefined;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", euro: "€" };
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML → plain text lines (block elements become line breaks). */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li|\/ul|\/ol|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
  return decode(text).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && l !== "•");
}

/** Shorten at the last sentence end before `max` characters. */
export function excerpt(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return { text: (end > max * 0.4 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim(), truncated: true };
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface BudgetAction { action?: string; expectedGrants?: unknown; minContribution?: unknown; maxContribution?: unknown; budgetYearMap?: Record<string, unknown> }

/** budgetOverview is a JSON string: { budgetTopicActionMap: { <id>: [ { action: "<TOPIC-ID> - <type>", budgetYearMap: { "2026": "40000000" }, … } ] } } */
export function parseBudget(raw: string | undefined, identifier: string): OfficialDetails["budget"] {
  if (!raw) return null;
  let parsed: { budgetTopicActionMap?: Record<string, BudgetAction[]> };
  try { parsed = JSON.parse(raw); } catch { return null; }
  const actions = Object.values(parsed.budgetTopicActionMap ?? {}).flat().filter((a): a is BudgetAction => !!a && typeof a === "object");
  const id = identifier.toUpperCase();
  const mine = actions.filter((a) => typeof a.action === "string" && a.action.toUpperCase().startsWith(id));
  const use = mine.length ? mine : actions.length === 1 ? actions : []; // a call-level map shared by several topics is not split by guesswork
  if (!use.length) return null;
  const by_year: Record<string, number> = {};
  for (const a of use) for (const [y, v] of Object.entries(a.budgetYearMap ?? {})) { const n = num(v); if (n !== null && /^\d{4}$/.test(y)) by_year[y] = (by_year[y] ?? 0) + n; }
  const total = Object.values(by_year).reduce((x, y) => x + y, 0);
  const grants = use.map((a) => num(a.expectedGrants));
  const mins = use.map((a) => num(a.minContribution)).filter((n): n is number => n !== null);
  const maxs = use.map((a) => num(a.maxContribution)).filter((n): n is number => n !== null);
  if (total === 0 && !mins.length && !maxs.length && grants.every((g) => g === null)) return null;
  return {
    total_eur: total,
    by_year,
    expected_grants: grants.every((g) => g !== null) ? grants.reduce<number>((x, g) => x + (g ?? 0), 0) : null,
    min_grant_eur: mins.length === use.length ? Math.min(...mins) : null,
    max_grant_eur: maxs.length === use.length ? Math.max(...maxs) : null,
  };
}

/** topicConditions HTML → numbered condition headings with their short text, plus official document links. */
export function parseConditions(html: string | undefined, allowedHosts: string[]): Pick<OfficialDetails, "conditions" | "documents"> {
  if (!html) return { conditions: [], documents: [] };
  const conditions: { heading: string; text: string }[] = [];
  let current: { heading: string; text: string } | null = null;
  for (const line of htmlToLines(html)) {
    if (/^conditions$/i.test(line)) continue;
    const m = line.match(/^(\d{1,2}[a-z]?)\s*\.\s*(.*)$/);
    if (m) {
      if (current) conditions.push(current);
      const rest = m[2]!;
      const i = rest.indexOf(":");
      current = i > 0 && i < 120 ? { heading: rest.slice(0, i).trim(), text: rest.slice(i + 1).trim() } : { heading: rest.trim(), text: "" };
    } else if (current) {
      current.text = `${current.text} ${line}`.trim();
    }
  }
  if (current) conditions.push(current);
  const documents: { label: string; url: string }[] = [];
  for (const a of html.matchAll(/<a\s[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decode(a[1]!.trim());
    let ok = false;
    try { const u = new URL(url); ok = u.protocol === "https:" && allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)); } catch { ok = false; }
    if (!ok || documents.some((d) => d.url === url)) continue;
    const label = decode(a[2]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || url.split("/").pop() || url;
    documents.push({ label: label.slice(0, 120), url });
    if (documents.length >= 5) break;
  }
  return {
    conditions: conditions.filter((c) => c.heading).slice(0, CONDITIONS_MAX)
      .map((c) => ({ heading: c.heading.slice(0, 120), text: excerpt(c.text, CONDITION_TEXT_MAX).text })),
    documents,
  };
}

/** All official details for one search result's metadata; undefined when the portal published none of them. */
export function extractDetails(m: Record<string, unknown>, identifier: string, allowedHosts: string[]): OfficialDetails | undefined {
  const budget = parseBudget(str(m.budgetOverview), identifier);
  const action = str(m.typesOfAction) ?? null;
  const submission = str(m.deadlineModel) ?? null;
  const callId = str(m.callIdentifier);
  const call = callId ? { identifier: callId, title: str(m.callTitle) ?? null } : null;
  const planned = str(m.startDate) ?? null;
  const desc = str(m.descriptionByte);
  const scopeText = desc ? htmlToLines(desc).join("\n") : "";
  const scope = scopeText ? { ...excerpt(scopeText, SCOPE_MAX), lang: "en" } : null;
  const { conditions, documents } = parseConditions(str(m.topicConditions), allowedHosts);
  if (!budget && !action && !submission && !call && !scope && !conditions?.length) return undefined;
  return { source: "eu-funding-tenders", budget, action_type: action, submission, call, planned_opening: planned, scope_excerpt: scope, conditions, documents };
}
