import "./load-env";
import postgres from "postgres";
import { SOURCE_SEEDS, CATEGORY_SEEDS } from "../db/seed/sources";
import { SYNTHETIC_OPPORTUNITIES } from "../db/seed/synthetic-opportunities";
import { legacyEnvelopesToRecords } from "../src/lib/domain/engine/legacy";

/** Idempotent seed: sources & categories (never downgrades a source's lifecycle) + clearly labelled synthetic opportunities. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      for (const [i, [code, el, en]] of CATEGORY_SEEDS.entries()) {
        await tx`INSERT INTO opportunity_categories (code, name_el, name_en, sort) VALUES (${code}, ${el}, ${en}, ${i})
                 ON CONFLICT (code) DO UPDATE SET name_el = EXCLUDED.name_el, name_en = EXCLUDED.name_en, sort = EXCLUDED.sort`;
      }
      for (const s of SOURCE_SEEDS) {
        // Research findings are refreshed on every seed; lifecycle/health columns are never touched here.
        await tx`INSERT INTO sources (slug, name, authority, scope, country, base_url, allowed_hosts, access_method, adapter, check_interval_minutes,
                                      compliance_notes, access_status, auth_required, robots_status, terms_url, licence_notes, config)
                 VALUES (${s.slug}, ${s.name}, ${s.authority}, ${s.scope}, ${s.country}, ${s.base_url}, ${s.allowed_hosts}, ${s.access_method}, ${s.adapter},
                         ${s.check_interval_minutes}, ${s.compliance_notes}, ${s.access_status}, ${s.auth_required}, ${s.robots_status}, ${s.terms_url ?? null},
                         ${s.licence_notes ?? null}, ${tx.json((s.config ?? {}) as never)})
                 ON CONFLICT (slug) DO UPDATE SET compliance_notes = EXCLUDED.compliance_notes, auth_required = EXCLUDED.auth_required,
                   robots_status = EXCLUDED.robots_status, terms_url = EXCLUDED.terms_url, licence_notes = EXCLUDED.licence_notes,
                   adapter = EXCLUDED.adapter, access_method = EXCLUDED.access_method, allowed_hosts = EXCLUDED.allowed_hosts, config = EXCLUDED.config,
                   access_status = CASE WHEN sources.access_status IN ('verified','inaccessible') THEN sources.access_status ELSE EXCLUDED.access_status END`;
      }
      const now = Date.now();
      for (const o of SYNTHETIC_OPPORTUNITIES) {
        const canonical = `https://test-data.example/opportunity/${o.key}`;
        const closes = o.days_until_close === null ? null : new Date(now + o.days_until_close * 86_400_000);
        const r = o.requirements;
        const conv = legacyEnvelopesToRecords(r, { idPrefix: o.key, fallbackUrl: canonical, lang: "en" });
        const [row] = await tx<{ id: string }[]>`
          INSERT INTO opportunities (
            is_synthetic, official_title, summary_plain, summary_origin, opportunity_type, publishing_authority, canonical_url,
            status, status_confidence, closes_at, deadline_state, last_retrieved_at, last_verified_at,
            funding_amount_state, funding_min, funding_max, funding_intensity_pct,
            applicant_types, geographic_scope, age_requirement, education_requirement, employment_requirement,
            business_stage_requirement, sector_requirement, cofinancing_requirement, review_status, extraction_confidence,
            publication_basis, deadline_kind, deadline_original_text, deadline_is_date_only, requirement_set_completeness)
          VALUES (
            true, ${o.official_title}, ${o.summary_plain}, 'admin', ${o.opportunity_type}, ${o.publishing_authority}, ${canonical},
            ${o.status}, 'high', ${closes}, ${closes ? "known" : "unknown"}, now(), ${o.status === "unverified" ? null : new Date()},
            ${o.funding ? "known" : "unknown"}, ${o.funding?.min ?? null}, ${o.funding?.max ?? null}, ${o.intensity_pct},
            ${tx.json(r.applicant_types as never)}, ${tx.json(r.geographic_scope as never)}, ${tx.json(r.age_requirement as never)},
            ${tx.json(r.education_requirement as never)}, ${tx.json(r.employment_requirement as never)},
            ${tx.json(r.business_stage_requirement as never)}, ${tx.json(r.sector_requirement as never)},
            ${tx.json(r.cofinancing_requirement as never)}, 'approved', 'high',
            'synthetic', ${closes ? "official" : "not_announced"}, ${closes ? closes.toISOString() : null}, false, ${conv.completeness})
          ON CONFLICT (canonical_url) WHERE merged_into_id IS NULL
          DO UPDATE SET closes_at = EXCLUDED.closes_at, last_verified_at = EXCLUDED.last_verified_at, deadline_original_text = EXCLUDED.deadline_original_text,
                        requirement_set_completeness = EXCLUDED.requirement_set_completeness, publication_basis = 'synthetic', updated_at = now()
          RETURNING id`;
        for (const req of conv.records) {
          await tx`INSERT INTO opportunity_requirements (opportunity_id, requirement_key, version, category, kind, value, original_text, original_lang,
                                                         evidence, evidence_rank, confidence, flags, origin, verified_at)
                   VALUES (${row!.id}, ${req.key}, 1, ${req.category}, ${req.kind}, ${tx.json(req.value as never)}, ${req.original_text}, ${req.original_lang},
                           ${tx.json(req.evidence as never)}, ${req.evidence_rank}, ${req.confidence}, ${req.flags}, 'synthetic', now())
                   ON CONFLICT (opportunity_id, requirement_key, version) DO NOTHING`;
        }
        for (const c of o.categories) {
          await tx`INSERT INTO opportunity_category_links (opportunity_id, category_code) VALUES (${row!.id}, ${c}) ON CONFLICT DO NOTHING`;
        }
      }
    });
    const [counts] = await sql`SELECT (SELECT count(*) FROM sources) AS sources, (SELECT count(*) FROM opportunity_categories) AS categories,
                                      (SELECT count(*) FROM opportunities WHERE is_synthetic) AS synthetic_opportunities`;
    console.log("seed complete:", counts);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
