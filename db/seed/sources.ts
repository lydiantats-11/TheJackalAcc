/**
 * Source registry seed. Being listed here is NOT the same as being monitored:
 *   lifecycle   configured → tested → active (set only by real runs / an admin; never by this seed)
 *   access_status  what research found about automated access (see SOURCES.md, 2026-10-13)
 * Research findings below are refreshed on every seed; lifecycle and health columns are never overwritten.
 */
export interface SourceSeed {
  slug: string;
  name: string;
  authority: string;
  scope: "national" | "regional" | "eu";
  country: string | null;
  base_url: string;
  allowed_hosts: string[];
  access_method: "api" | "rss" | "sitemap" | "html" | "document" | "manual";
  adapter: string;
  check_interval_minutes: number;
  access_status: "untested" | "undocumented" | "blocked_by_robots" | "unsupported";
  auth_required: "none" | "api_key" | "account" | "unknown";
  robots_status: "unknown" | "allowed" | "disallowed" | "partial";
  terms_url?: string;
  licence_notes?: string;
  config?: Record<string, unknown>;
  compliance_notes: string;
}

const ROBOTS_BLOCKED =
  "2026-10-13: an automated fetch of robots.txt was refused by the site's robots rules for our research tool's user agent. " +
  "Automated collection must NOT be built until the owner inspects robots.txt and the terms of use from a normal browser and records them here.";

export const SOURCE_SEEDS: SourceSeed[] = [
  {
    slug: "eu-funding-tenders", name: "EU Funding & Tenders Portal", authority: "European Commission", scope: "eu", country: null,
    base_url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home",
    allowed_hosts: ["ec.europa.eu", "api.tech.ec.europa.eu"], access_method: "api", adapter: "eu-funding-tenders-search",
    check_interval_minutes: 360, access_status: "undocumented", auth_required: "none", robots_status: "unknown",
    licence_notes: "Commission content is generally reusable under Decision 2011/833/EU; to be confirmed for this endpoint.",
    config: { pageSize: 100, maxPages: 20, statuses: ["31094501", "31094502"], types: ["1"], languages: ["en"] },
    compliance_notes:
      "Public search endpoint used by the portal itself (POST api.tech.ec.europa.eu/search-api/prod/rest/search, apiKey=SEDIA). " +
      "No official public documentation found; shape known from independent open-source clients. No published rate limit: " +
      "we poll every 6 h with ≤20 pages. Not reachable from the build workspace — first live test must run from the owner's machine.",
  },
  {
    slug: "ted", name: "TED — Tenders Electronic Daily", authority: "Publications Office of the European Union", scope: "eu", country: null,
    base_url: "https://ted.europa.eu/", allowed_hosts: ["ted.europa.eu", "api.ted.europa.eu"], access_method: "api", adapter: "manual",
    check_interval_minutes: 720, access_status: "untested", auth_required: "none", robots_status: "unknown",
    terms_url: "https://ted.europa.eu/en/legal-notice",
    compliance_notes: "Official documented Search API v3 (POST https://api.ted.europa.eu/v3/notices/search), no key needed for published notices. Connector planned next.",
  },
  {
    slug: "gov-gr", name: "gov.gr — Ψηφιακές υπηρεσίες", authority: "Ελληνική Δημοκρατία", scope: "national", country: "GR",
    base_url: "https://www.gov.gr/", allowed_hosts: ["gov.gr"], access_method: "sitemap", adapter: "manual", check_interval_minutes: 1440,
    access_status: "untested", auth_required: "none", robots_status: "partial",
    compliance_notes: "robots.txt (2026-10-13) allows general crawling, disallows /api/ and login/user areas, and lists /sitemap.xml. Sitemap-based change detection is the permitted route.",
  },
  {
    slug: "gov-gr-epidoteseis", name: "gov.gr — Επιδοτήσεις πολιτών", authority: "Ελληνική Δημοκρατία", scope: "national", country: "GR",
    base_url: "https://www.gov.gr/el/categories/periousia-kai-phorologia/epidoteseis-politon", allowed_hosts: ["gov.gr"], access_method: "html",
    adapter: "manual", check_interval_minutes: 720, access_status: "untested", auth_required: "none", robots_status: "partial",
    compliance_notes: "Category page is under an allowed path per robots.txt (2026-10-13). Lists citizen benefits — mostly not business funding; needs classification.",
  },
  {
    slug: "espa", name: "ΕΣΠΑ", authority: "Υπουργείο Εθνικής Οικονομίας και Οικονομικών", scope: "national", country: "GR",
    base_url: "https://www.espa.gr/EL/Pages/default.aspx", allowed_hosts: ["espa.gr"], access_method: "html", adapter: "manual",
    check_interval_minutes: 720, access_status: "blocked_by_robots", auth_required: "none", robots_status: "unknown",
    compliance_notes: ROBOTS_BLOCKED + " Alternative: the same calls are published as decisions on Diavgeia (official open data).",
  },
  // Added 20 Oct 2026 (owner approval): official sources of the business calls imported after manual review.
  // adapter "manual" = no automated collection; nothing is monitored or scheduled.
  {
    slug: "opske", name: "ΟΠΣΚΕ — Ολοκληρωμένο Πληροφοριακό Σύστημα Κρατικών Ενισχύσεων", authority: "Υπουργείο Εθνικής Οικονομίας και Οικονομικών (ΕΥΚΕ-ΧΕ)",
    scope: "national", country: "GR", base_url: "https://opske.gr/el/search-calls", allowed_hosts: ["opske.gr"], access_method: "html", adapter: "manual",
    check_interval_minutes: 720, access_status: "untested", auth_required: "none", robots_status: "unknown",
    compliance_notes: "2026-10-20: call pages and call PDFs under opske.gr/sites/default/files/calls/ were readable by the research tool. Applications are filed on app.opske.gr (login required). Manual review only.",
  },
  {
    slug: "efepae", name: "ΕΦΕΠΑΕ — Ενδιάμεσος Φορέας", authority: "ΕΦΕΠΑΕ", scope: "national", country: "GR",
    base_url: "https://efepae.gr/", allowed_hosts: ["efepae.gr"], access_method: "html", adapter: "manual", check_interval_minutes: 720,
    access_status: "untested", auth_required: "none", robots_status: "unknown",
    compliance_notes: "2026-10-20: action pages (efepae.gr/drasi/…) and amendment PDFs were readable by the research tool. Intermediate body for ΕΣΠΑ business calls. Manual review only.",
  },
  {
    slug: "minfin", name: "Υπουργείο Εθνικής Οικονομίας και Οικονομικών", authority: "Υπουργείο Εθνικής Οικονομίας και Οικονομικών", scope: "national", country: "GR",
    base_url: "https://minfin.gov.gr/", allowed_hosts: ["minfin.gov.gr"], access_method: "html", adapter: "manual", check_interval_minutes: 1440,
    access_status: "untested", auth_required: "none", robots_status: "unknown",
    compliance_notes: "2026-10-20: press releases, private-debt pages and circular PDFs were readable by the research tool. Manual review only.",
  },
  {
    slug: "aade", name: "ΑΑΔΕ — Ανεξάρτητη Αρχή Δημοσίων Εσόδων", authority: "ΑΑΔΕ", scope: "national", country: "GR",
    base_url: "https://www.aade.gr/egkyklioi-kai-apofaseis", allowed_hosts: ["aade.gr"], access_method: "html", adapter: "manual", check_interval_minutes: 1440,
    access_status: "untested", auth_required: "none", robots_status: "unknown",
    compliance_notes: "2026-10-20: decision pages and decision PDFs under aade.gr/sites/default/files/ were readable by the research tool. Regulatory updates; manual review only.",
  },
  {
    slug: "dypa", name: "ΔΥΠΑ", authority: "Δημόσια Υπηρεσία Απασχόλησης", scope: "national", country: "GR",
    base_url: "https://www.dypa.gov.gr/", allowed_hosts: ["dypa.gov.gr"], access_method: "html", adapter: "manual", check_interval_minutes: 720,
    access_status: "blocked_by_robots", auth_required: "none", robots_status: "unknown", compliance_notes: ROBOTS_BLOCKED,
  },
  {
    slug: "gsri", name: "Γενική Γραμματεία Έρευνας και Καινοτομίας", authority: "ΓΓΕΚ", scope: "national", country: "GR",
    base_url: "https://gsri.gov.gr/", allowed_hosts: ["gsri.gov.gr"], access_method: "html", adapter: "manual", check_interval_minutes: 1440,
    access_status: "blocked_by_robots", auth_required: "none", robots_status: "unknown", compliance_notes: ROBOTS_BLOCKED,
  },
  {
    slug: "elevate-greece", name: "Elevate Greece", authority: "Ελληνική Δημοκρατία", scope: "national", country: "GR",
    base_url: "https://elevategreece.gov.gr/el/", allowed_hosts: ["elevategreece.gov.gr"], access_method: "html", adapter: "manual",
    check_interval_minutes: 1440, access_status: "untested", auth_required: "unknown", robots_status: "unknown",
    compliance_notes: "2026-10-13: robots.txt could not be retrieved (request error). Startup registry; may announce support programmes. Not yet researched further.",
  },
  {
    slug: "diavgeia", name: "Διαύγεια — αποφάσεις δημόσιων φορέων", authority: "Υπουργείο Εσωτερικών", scope: "national", country: "GR",
    base_url: "https://diavgeia.gov.gr/", allowed_hosts: ["diavgeia.gov.gr"], access_method: "api", adapter: "manual", check_interval_minutes: 720,
    access_status: "untested", auth_required: "unknown", robots_status: "unknown",
    compliance_notes:
      "Candidate permitted alternative for Greek calls (official open-data publication of public decisions, identified by ΑΔΑ). " +
      "2026-10-13: the site reported emergency maintenance (search by ΑΔΑ only); API documentation not yet retrieved.",
  },
];

export const CATEGORY_SEEDS: Array<[code: string, el: string, en: string]> = [
  ["startup_grants", "Επιχορηγήσεις για νέες επιχειρήσεις", "Grants for new businesses"],
  ["sme_funding", "Χρηματοδότηση ΜμΕ και startups", "SME and startup funding"],
  ["self_employment", "Επιχειρηματικότητα και αυτοαπασχόληση", "Entrepreneurship and self-employment"],
  ["youth", "Νεανική επιχειρηματικότητα", "Youth entrepreneurship"],
  ["employment", "Επιδοτήσεις απασχόλησης και προσλήψεων", "Employment and hiring subsidies"],
  ["training", "Κατάρτιση και εκπαίδευση", "Training and education"],
  ["regional_investment", "Περιφερειακά και αναπτυξιακά κίνητρα", "Regional and investment incentives"],
  ["research_innovation", "Έρευνα, καινοτομία, ψηφιακός μετασχηματισμός", "Research, innovation and digital"],
  ["sectoral", "Τομεακά προγράμματα (αγροτικά, τουρισμός κ.ά.)", "Sector programmes (agriculture, tourism, etc.)"],
  ["procurement", "Δημόσιοι διαγωνισμοί", "Public procurement tenders"],
  ["eu_calls", "Ευρωπαϊκές προσκλήσεις", "EU calls for proposals"],
  ["organisations", "Φορείς, πανεπιστήμια, ΜΚΟ", "Organisations, universities, nonprofits"],
];
