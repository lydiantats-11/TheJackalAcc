#!/usr/bin/env python3
"""Γνώση content audit (owner review, 23 Oct 2026 18:07): which register entries lack Greek or English text or titles.
Reads data/knowledge/register.json (the imported K1 workbook) and writes data/knowledge/content-audit.json.
Nothing is changed in the register; the pages show «Περιεχόμενο υπό προετοιμασία» for every entry without text."""
import json, collections, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
reg = json.loads((root / "data/knowledge/register.json").read_text("utf-8"))["entries"]
def txt(e, l):
    d = e.get("draft") or {}
    b = e.get("body") or {}
    return bool((b.get(l) or d.get(l) or "").strip())
rows = []
for e in reg:
    rows.append({"id": e["id"], "kind": e["kind"], "topic": e["topic"], "title_el": e["title"].get("el"),
                 "has_title_en": bool(e["title"].get("en")), "has_text_el": txt(e, "el"), "has_text_en": txt(e, "en"),
                 "status": e["verification"]["status"]})
by = collections.defaultdict(lambda: collections.Counter())
for r in rows:
    c = by[r["kind"]]; c["total"] += 1
    c["no_text_el"] += not r["has_text_el"]; c["no_text_en"] += not r["has_text_en"]; c["no_title_en"] += not r["has_title_en"]
out = {
    "generated_from": "data/knowledge/register.json",
    "summary": {k: dict(v) for k, v in by.items()},
    "totals": {"entries": len(rows), "no_text_el": sum(not r["has_text_el"] for r in rows),
               "no_text_en": sum(not r["has_text_en"] for r in rows), "no_title_en": sum(not r["has_title_en"] for r in rows),
               "duplicate_ids": len(rows) - len({r["id"] for r in rows}),
               "duplicate_titles_el": sorted(t for t, n in collections.Counter(r["title_el"] for r in rows).items() if n > 1)},
    "missing_text": [{"id": r["id"], "title_el": r["title_el"], "kind": r["kind"], "topic": r["topic"],
                      "missing": [m for m, ok in (("text_el", r["has_text_el"]), ("text_en", r["has_text_en"]), ("title_en", r["has_title_en"])) if not ok]}
                     for r in rows if not (r["has_text_el"] and r["has_text_en"] and r["has_title_en"])],
}
(root / "data/knowledge/content-audit.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", "utf-8")
print(json.dumps({"summary": out["summary"], "totals": out["totals"]}, ensure_ascii=False, indent=1))
