#!/usr/bin/env python3
"""
Builds db/seed/official-records-2026-10-14.sql from data/official-records-2026-10-14.v2.json.

The records were checked by hand on official pages on 14 Oct 2026. They are imported as:
  publication_basis = 'manual_review', review_status = 'pending', requirement origin = 'manual_review',
  requirement_set_completeness = 'partial'  (nobody has confirmed the rule list is complete)
so they appear in Ευκαιρίες only after the owner approves them, and can never be shown as fully verified.

Not imported: TED (a source directory, already in the source registry), Spain (future expansion), the European
Solidarity Corps (volunteering, removed from scope by the owner on 14 Oct 2026),
EIC Accelerator (the EU Funding & Tenders connector will bring it with an official identifier; importing it by hand
would create a duplicate).

Re-runnable: every record has external_key 'manual:<id>'; the SQL deletes and re-inserts only those rows.
Usage: python3 scripts/build_official_seed.py && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed/official-records-2026-10-14.sql
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "official-records-2026-10-14.v2.json"
OUT = ROOT / "db" / "seed" / "official-records-2026-10-14.sql"
CHECKED_AT = "2026-10-14T00:00:00+03:00"  # date precision: exact per-page times were not recorded

EU27 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
        "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]
SKIP = {"ted": "source directory — kept in the sources table", "beckham": "Spain — future expansion, not monitored",
        "esc": "volunteering — removed from scope by the owner on 14 Oct 2026",
        "eic": "will be imported by the EU Funding & Tenders connector with its official identifier"}

KIND = {"round": "application_round", "call": "call", "service": "standing_procedure", "programme": "programme", "tax": "tax_regime"}
TYPE = {"discovereu": "other", "esc": "other", "art5c": "tax_incentive", "art5b": "tax_incentive", "art5a": "tax_incentive",
        "spiti2": "loan", "studenthousing": "public_benefit", "a21": "public_benefit", "unemployment": "public_benefit"}

# Normalised engine values for each demo rule, in the order the rules appear in the record. None = not machine-evaluated.
VALUES = {
    "discovereu": [("birth_date_range", {"from": "2008-01-01", "to": "2008-12-31"}),
                   ("residence", {"countries": EU27 + ["IS", "LI", "MK", "NO", "RS", "TR"], "basis": "residence_or_citizenship"})],
    "esc": [("age", {"min": 18, "max": 30}), ("other", None)],
    "art5c": [("tax_residence_transfer", {"required": True}), ("prior_tax_residence", {"window_years": 6, "max_resident_years": 1}),
              ("moving_from", {"groups": ["eu_eea", "agreement"]}), ("activity_in_greece", {"activities": ["employee_gr", "own_business"]}),
              ("intent_to_stay", {"min_years": 2})],
    "art5b": [("tax_residence_transfer", {"required": True}), ("prior_tax_residence", {"window_years": 6, "max_resident_years": 1}),
              ("moving_from", {"groups": ["eu_eea", "agreement"]}), ("activity_in_greece", {"activities": ["pension"]})],
    "art5a": [("prior_tax_residence", {"window_years": 8, "max_resident_years": 1}), ("investment_amount", {"min_eur": 500000})],
    "studenthousing": [("student_status", {"required": True}), ("residence", {"countries": EU27, "basis": "citizenship"}),
                       ("residence", {"countries": ["GR"], "basis": "tax_residence"}), ("other", None)],
    "a21": [("dependent_children", {"min": 1}), ("residence", {"countries": ["GR"], "basis": "residence"}), ("other", None)],
    "unemployment": [("employment", {"statuses": ["unemployed"]}), ("employment_end", {"reasons": ["ended_by_employer", "contract_ended"]}),
                     ("unemployment_registration", {"required": True}), ("other", None)],
    "spiti2": [],
}
# Re-checked on 14 Oct 2026 (stegasi.gov.gr) but not in the demo rules: Σπίτι μου ΙΙ age limit.
EXTRA = {"spiti2": [("age", {"min": 25, "max": 50}, "ηλικίας από είκοσι πέντε (25) έως πενήντα (50) ετών", "https://stegasi.gov.gr/programs/spiti-mou-ii/")]}

DEADLINE = {  # (deadline_state, deadline_kind, closes_at, is_date_only)
    "discovereu": ("known", "official", "2026-10-15T10:00:00Z", False),
    "a21": ("known", "official", "2026-11-13T16:00:00Z", False),
    "spiti2": ("known", "official", "2026-05-31T20:59:59Z", True),
    "studenthousing": ("known", "official", "2026-09-22T20:59:59Z", True),
    "art5a": ("known", "official", "2027-03-31T20:59:59Z", True),
    "art5b": ("known", "official", "2027-03-31T20:59:59Z", True),
    "art5c": ("rolling", "rolling", None, False),
    "esc": ("not_applicable", "not_applicable", None, False),
    "unemployment": ("not_applicable", "not_applicable", None, False),
}
# Records that share one official document get a per-regime anchor so canonical_url stays unique.
ANCHOR = {"art5a": "#article-5a", "art5b": "#article-5b"}
STATUS = {"open": "open", "rolling": "open", "closed": "closed", "future": "unverified"}


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def clean_evidence(e):
    """The engine's schema allows excerpt/location to be absent but not null: drop empty keys."""
    return {k: v for k, v in e.items() if v not in (None, "")}


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    out = ["-- GENERATED by scripts/build_official_seed.py — do not edit by hand.",
           f"-- Source: {SRC.name} ({data['schema_version']}), checked on {data['verification']['checked_on']} by manual review.",
           "-- Imported as review_status = 'pending': nothing appears in Ευκαιρίες until the owner approves it.",
           "BEGIN;",
           "DELETE FROM opportunities WHERE external_key LIKE 'manual:%' AND publication_basis = 'manual_review';"]
    skipped, imported = [], []
    for r in data["records"]:
        rid = r["id"]
        if rid in SKIP:
            skipped.append(f"--   {rid}: {SKIP[rid]}")
            continue
        st = r["application_status"]
        dstate, dkind, closes, date_only = DEADLINE[rid]
        amount = r["funding_or_benefit"]["value"]
        summary = r["summary"]["el"] + (f" Ποσό / όφελος: {amount['el']}" if amount else " Ποσό / όφελος: δεν αναφέρεται στην πηγή.")
        unc = r["uncertainties"] + [c["en"] for c in r.get("conflicts", []) if c["en"] not in " ".join(r["uncertainties"])]
        evidence = {"checked_on": "2026-10-14", "method": "manual review of official pages",
                    "sources": [s["url"] for s in r["official_sources"]], "status_as_checked": st["value"]}
        cols = {
            "is_synthetic": False, "official_identifier": None, "official_title": r["official_title"]["el"], "title_lang": "el",
            "summary_plain": summary, "summary_origin": "admin", "opportunity_type": TYPE[rid],
            "publishing_authority": r["issuing_authority"]["el"], "canonical_url": r["official_sources"][0]["url"] + ANCHOR.get(rid, ""),
            "application_url": r["official_application_url"], "opens_at": st.get("opens_at"), "closes_at": closes,
            "deadline_state": dstate, "deadline_kind": dkind, "deadline_is_date_only": date_only,
            "deadline_timezone": st.get("timezone") or "Europe/Athens",
            "deadline_original_text": (st.get("deadline_original_wording") or {}).get("el"),
            "last_retrieved_at": CHECKED_AT, "last_verified_at": CHECKED_AT, "status": STATUS[st["value"]],
            "status_confidence": "medium", "status_evidence": evidence, "status_reason": "manual_review_2026_10_14",
            "review_status": "pending", "publication_basis": "manual_review", "external_key": f"manual:{rid}",
            "record_kind": KIND[r["record_kind"]], "stale_after_days": st.get("stale_after_days"), "uncertainties": unc,
            "requirement_set_completeness": "partial", "has_conflict": False,
        }
        out.append(f"\n-- {rid}: {r['official_title']['en']}")
        out.append(f"WITH o AS (INSERT INTO opportunities ({', '.join(cols)}) VALUES ({', '.join(q(v) for v in cols.values())}) RETURNING id)")
        reqs = []
        rules = r["eligibility_rules"]
        for n, (rule, (cat, value)) in enumerate(zip(rules, VALUES[rid]), start=1):
            quote = rule.get("official_quote")
            label = rule["label"]["el"]
            reqs.append({
                "requirement_key": f"{cat}-{n}", "category": cat, "kind": "informational" if value is None else "mandatory",
                "value": value, "original_text": quote or label, "original_lang": "en" if quote and quote.isascii() else "el",
                "interpretation": label, "evidence": clean_evidence(rule["evidence"]), "evidence_rank": 2,
                "confidence": "high" if quote else "medium", "flags": [], "verified_at": CHECKED_AT,
            })
        for cat, value, quote, url in EXTRA.get(rid, []):
            reqs.append({"requirement_key": f"{cat}-x", "category": cat, "kind": "mandatory", "value": value, "original_text": quote,
                         "original_lang": "el", "interpretation": None, "evidence": {"source_url": url, "excerpt": quote, "checked_on": "2026-10-14"},
                         "evidence_rank": 2, "confidence": "high", "flags": [], "verified_at": CHECKED_AT})
        if len(rules) != len(VALUES[rid]):
            raise SystemExit(f"{rid}: {len(rules)} rules in JSON but {len(VALUES[rid])} normalised values")
        if reqs:
            rows = ",\n  ".join(
                "((SELECT id FROM o), " + ", ".join([q(x["requirement_key"]), q(x["category"]), q(x["kind"]), q(x["value"]),
                q(x["original_text"]), q(x["original_lang"]), q(x["interpretation"]), q(x["evidence"]), str(x["evidence_rank"]),
                q(x["confidence"]), "'{}'::text[]", "'manual_review'", q(x["verified_at"])]) + ")" for x in reqs)
            out.append("INSERT INTO opportunity_requirements (opportunity_id, requirement_key, category, kind, value, original_text, "
                       "original_lang, interpretation, evidence, evidence_rank, confidence, flags, origin, verified_at)\nVALUES\n  " + rows + ";")
        else:
            out.append("SELECT id FROM o;")
        imported.append(rid)
    out.append("\nCOMMIT;")
    out.insert(4, "-- Imported: " + ", ".join(imported) + "\n-- Not imported:\n" + "\n".join(skipped))
    out.append("\n-- After reviewing each record in Admin → AI review / the database, approve with:")
    out.append("--   UPDATE opportunities SET review_status = 'approved' WHERE external_key = 'manual:<id>';")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(imported)} records imported, {len(skipped)} skipped")


if __name__ == "__main__":
    main()
