#!/usr/bin/env bash
# Live test of the EU Funding & Tenders connector against the REAL official API (LIVE_CONNECTOR_TEST.md, automated).
# Runs on a throwaway database (GitHub Actions service container). Writes everything into $OUT and a pass/fail
# summary into $OUT/LIVE_TEST_REPORT.md. A pass on fixtures is not a pass here: every check below reads live data.
#
# Needs: DATABASE_URL (empty database, migrations + seed already applied), node deps installed, psql, jq.
set -u
OUT="${OUT:-live-test-output}"
SLUG="eu-funding-tenders"
mkdir -p "$OUT"
REPORT="$OUT/LIVE_TEST_REPORT.md"
FAILS=0
q()  { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$1"; }
qv() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "$1"; }
pass() { echo "| $1 | ✅ pass | $2 |" >> "$REPORT"; }
fail() { echo "| $1 | ❌ FAIL | $2 |" >> "$REPORT"; FAILS=$((FAILS+1)); }
section() { echo -e "\n===== $1 =====" | tee -a "$OUT/sql.log"; }
# The worker prints JSON log lines, then the run result pretty-printed: keep only the final object.
run_worker() { # $1 = run name
  npm run --silent worker -- --test "$SLUG" > "$OUT/$1.raw.log" 2>&1; local code=$?
  awk '/^\{$/{buf=""; on=1} on{buf=buf $0 "\n"} END{printf "%s", buf}' "$OUT/$1.raw.log" > "$OUT/$1.json"
  echo "$code" > "$OUT/$1.exit"
  return 0
}
jf() { jq -r "$2 // empty" "$OUT/$1.json" 2>/dev/null; }
EU_FROM="FROM opportunities o JOIN sources s ON s.id=o.source_id WHERE s.slug='$SLUG'"

{
  echo "# Live connector test — EU Funding & Tenders"
  echo
  echo "- Started: $(date -u +%FT%TZ) on GitHub Actions (\`$(uname -sr)\`), commit \`${GITHUB_SHA:-local}\`"
  echo "- Endpoint: \`POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA\` (undocumented, public)"
  echo "- Database: throwaway PostgreSQL 16, deleted when the job ends. No real users or personal data."
  echo
  echo "| Check | Result | Evidence |"
  echo "|---|---|---|"
} > "$REPORT"

# ── 1. Retrieval ─────────────────────────────────────────────────────────────
section "1. retrieval (run1)"
run_worker run1
c=$(cat "$OUT/run1.exit"); st=$(jf run1 .status); new=$(jf run1 .outcomes.new); err=$(jf run1 .error)
cat "$OUT/run1.json" | tee -a "$OUT/sql.log"
if [ "$c" = 0 ] && { [ "$st" = succeeded ] || [ "$st" = partial ]; } && [ "${new:-0}" -gt 0 ] 2>/dev/null; then
  pass "1. Retrieval from the official source" "exit 0, status \`$st\`, $new new records"
else
  fail "1. Retrieval from the official source" "exit $c, status \`${st:-none}\`, new=${new:-?}, error: \`${err:-$(tail -3 "$OUT/run1.raw.log" | tr '\n|' '  ')}\`"
  echo -e "\n**Retrieval failed — the remaining checks cannot be meaningful and were skipped.** Full output: run1.raw.log" >> "$REPORT"
  echo "FAILS=$FAILS" >> "$REPORT"; exit 1
fi

# ── 2. Parsing and classification ────────────────────────────────────────────
section "2. parsing and classification"
q "SELECT official_identifier, left(official_title,60) title, opportunity_type, status, deadline_kind, closes_at, deadline_original_text, publication_basis, is_synthetic
   $EU_FROM ORDER BY closes_at NULLS LAST LIMIT 15;" | tee -a "$OUT/sql.log"
total=$(qv "SELECT count(*) $EU_FROM")
bad=$(qv "SELECT count(*) $EU_FROM AND (is_synthetic OR publication_basis <> 'official_structured' OR official_identifier IS NULL
         OR status NOT IN ('open','upcoming') OR canonical_url NOT LIKE 'https://%europa.eu/%')")
nodl=$(qv "SELECT count(*) $EU_FROM AND closes_at IS NOT NULL AND deadline_original_text IS NULL")
withdl=$(qv "SELECT count(*) $EU_FROM AND closes_at IS NOT NULL")
sample=$(qv "SELECT string_agg(official_identifier, ', ') FROM (SELECT official_identifier $EU_FROM ORDER BY official_identifier LIMIT 3) x")
[ "$bad" = 0 ] && [ "$nodl" = 0 ] \
  && pass "2. Parsing and classification" "$total records; 0 synthetic / non-official / wrong-status; $withdl with a deadline, all with original wording. e.g. $sample" \
  || fail "2. Parsing and classification" "$bad records break the rules, $nodl deadlines without original wording (of $total)"

# ── 3. Evidence-based storage ────────────────────────────────────────────────
section "3. evidence storage"
q "SELECT count(*) docs, count(DISTINCT content_hash) distinct_hashes FROM source_documents d JOIN sources s ON s.id=d.source_id WHERE s.slug='$SLUG';" | tee -a "$OUT/sql.log"
q "SELECT o.official_identifier, e.field, e.source_url, e.method, e.evidence_rank FROM opportunity_field_evidence e JOIN opportunities o ON o.id=e.opportunity_id
   JOIN sources s ON s.id=o.source_id WHERE s.slug='$SLUG' ORDER BY 1,2 LIMIT 10;" | tee -a "$OUT/sql.log"
q "SELECT id, status, started_at, finished_at, items_seen, items_new, items_changed, connector_version, error FROM ingestion_runs ORDER BY started_at DESC LIMIT 3;" | tee -a "$OUT/sql.log"
noev=$(qv "SELECT count(*) $EU_FROM AND NOT EXISTS (SELECT 1 FROM opportunity_field_evidence e WHERE e.opportunity_id=o.id AND e.source_url LIKE 'https://%')")
docs=$(qv "SELECT count(*) FROM source_documents d JOIN sources s ON s.id=d.source_id WHERE s.slug='$SLUG'")
runok=$(qv "SELECT count(*) FROM ingestion_runs r JOIN sources s ON s.id=r.source_id WHERE s.slug='$SLUG' AND r.finished_at IS NOT NULL AND r.connector_version IS NOT NULL")
[ "$noev" = 0 ] && [ "$docs" -gt 0 ] && [ "$runok" -ge 1 ] \
  && pass "3. Evidence-based storage in PostgreSQL" "$docs source documents; every record has field evidence with an official URL; run row has start, finish, counts, connector version" \
  || fail "3. Evidence-based storage in PostgreSQL" "$noev records without evidence, $docs documents, $runok complete run rows"

# ── 4. Duplicates and repeated imports ───────────────────────────────────────
section "4. repeat import (run2)"
n1=$total
run_worker run2
n2=$(qv "SELECT count(*) $EU_FROM"); new2=$(jf run2 .outcomes.new); unch2=$(jf run2 .outcomes.unchanged); ch2=$(jf run2 .outcomes.changed)
dups=$(qv "SELECT count(*) FROM (SELECT external_key FROM opportunities WHERE external_key IS NOT NULL GROUP BY 1 HAVING count(*)>1) d")
cat "$OUT/run2.json" | tee -a "$OUT/sql.log"
st2=$(jf run2 .status); unl2=$(jf run2 .unlisted_marked_unverified)
lst1=$(grep -o '"rows":[0-9]*,"total":[0-9]*' "$OUT/run1.raw.log" | head -1); lst2=$(grep -o '"rows":[0-9]*,"total":[0-9]*' "$OUT/run2.raw.log" | head -1)
if [ "$(cat "$OUT/run2.exit")" = 0 ] && [ "$st2" = succeeded ] && [ "$dups" = 0 ] && [ "${unl2:-0}" = 0 ] && [ $((n2 - n1)) = "${new2:-0}" ] && [ "${new2:-0}" -le 5 ]; then
  pass "4. Duplicate detection / safe repeat import" "before $n1, after $n2; run 2: new ${new2:-0}, changed ${ch2:-0}, unchanged ${unch2:-0}, wrongly unverified 0; 0 duplicate keys; listing run1 {$lst1} run2 {$lst2}"
else
  fail "4. Duplicate detection / safe repeat import" "before $n1, after $n2; run 2 status \`${st2:-?}\`, new=${new2:-?}, marked unverified=${unl2:-?}, duplicate keys=$dups; listing run1 {$lst1} run2 {$lst2}"
fi

# ── 5. Amendment / deadline change (simulated locally, corrected by the live source) ──
section "5. simulated amendment (run3)"
row=$(qv "SELECT o.id || '|' || o.closes_at || '|' || o.version $EU_FROM AND o.closes_at IS NOT NULL ORDER BY o.official_identifier LIMIT 1")
id=${row%%|*}; rest=${row#*|}; orig=${rest%|*}; v0=${rest##*|}
q "UPDATE opportunities SET closes_at = closes_at + interval '30 days', content_fingerprint='simulated' WHERE id='$id' RETURNING id, official_identifier, closes_at;" | tee -a "$OUT/sql.log"
run_worker run3
cat "$OUT/run3.json" | tee -a "$OUT/sql.log"
q "SELECT version, change_kind, created_at FROM opportunity_versions WHERE opportunity_id='$id' ORDER BY version;" | tee -a "$OUT/sql.log"
after=$(qv "SELECT closes_at FROM opportunities WHERE id='$id'"); v1=$(qv "SELECT version FROM opportunities WHERE id='$id'")
vers=$(qv "SELECT count(*) FROM opportunity_versions WHERE opportunity_id='$id'"); ch3=$(jf run3 .outcomes.changed)
unl3=$(jf run3 .unlisted_marked_unverified)
if [ "$after" = "$orig" ] && [ "${v1:-0}" -gt "${v0:-0}" ] && [ "${ch3:-0}" -ge 1 ] && [ "${unl3:-0}" = 0 ]; then
  pass "5. Amendment / deadline change (SIMULATED)" "deadline falsified +30 days locally; run 3 restored the official \`$orig\`, version $v0 → $v1, $vers version rows kept; run 3 changed ${ch3} in total, wrongly unverified 0"
else
  fail "5. Amendment / deadline change (SIMULATED)" "official \`$orig\`, after run 3 \`$after\`, version $v0 → $v1, changed=${ch3:-?}, marked unverified=${unl3:-?}"
fi

# ── 6. Display in Ευκαιρίες ──────────────────────────────────────────────────
section "6. display"
PORT=3000 npm start > "$OUT/next-start.log" 2>&1 &
APP=$!
for i in $(seq 1 60); do curl -fs -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
code=$(curl -s -o "$OUT/opportunities.html" -w '%{http_code}' "http://127.0.0.1:3000/opportunities")
title=$(qv "SELECT official_title $EU_FROM ORDER BY official_identifier LIMIT 1")
oppid=$(qv "SELECT o.id $EU_FROM ORDER BY official_identifier LIMIT 1")
ident=$(qv "SELECT official_identifier $EU_FROM ORDER BY official_identifier LIMIT 1")
dcode=$(curl -s -o "$OUT/opportunity-detail.html" -w '%{http_code}' "http://127.0.0.1:3000/opportunities/$oppid")
node scripts/live-test-screenshots.mjs "$OUT" "$oppid" >> "$OUT/sql.log" 2>&1 || echo "screenshots failed" >> "$OUT/sql.log"
shown=$(grep -c "europa.eu" "$OUT/opportunity-detail.html" || true)
if [ "$code" = 200 ] && [ "$dcode" = 200 ] && grep -q "$ident" "$OUT/opportunity-detail.html" && [ "$shown" -gt 0 ]; then
  pass "6. Display in Ευκαιρίες" "list page 200, record \`$ident\` page 200 with its official europa.eu link; screenshots attached"
else
  fail "6. Display in Ευκαιρίες" "list $code, detail $dcode for \`$ident\` (see opportunities.html / next-start.log)"
fi
kill $APP 2>/dev/null

# ── 7. Freshness and failure reporting ───────────────────────────────────────
section "7a. freshness"
q "SELECT slug, lifecycle, last_success_at, last_check_at, consecutive_failures FROM sources WHERE slug='$SLUG';" | tee -a "$OUT/sql.log"
lastok=$(qv "SELECT last_success_at IS NOT NULL FROM sources WHERE slug='$SLUG'")
lc=$(qv "SELECT lifecycle FROM sources WHERE slug='$SLUG'")
[ "$lastok" = t ] && pass "7a. Source freshness recorded" "last_success_at set; lifecycle \`$lc\`" || fail "7a. Source freshness recorded" "last_success_at missing"

section "7b. failure (official host made unreachable)"
f0=$(qv "SELECT consecutive_failures FROM sources WHERE slug='$SLUG'")
before=$(qv "SELECT count(*) || '|' || max(o.updated_at) || '|' || count(*) FILTER (WHERE status='closed') $EU_FROM")
echo "127.0.0.1 api.tech.ec.europa.eu" | sudo tee -a /etc/hosts >/dev/null
run_worker run4
sudo sed -i '/api.tech.ec.europa.eu/d' /etc/hosts
cat "$OUT/run4.json" | tee -a "$OUT/sql.log"
after=$(qv "SELECT count(*) || '|' || max(o.updated_at) || '|' || count(*) FILTER (WHERE status='closed') $EU_FROM")
f1=$(qv "SELECT consecutive_failures FROM sources WHERE slug='$SLUG'")
st4=$(jf run4 .status); err4=$(jf run4 .error)
if [ "$(cat "$OUT/run4.exit")" = 1 ] && [ "$st4" = failed ] && [ "$f1" -gt "$f0" ] && [ "$before" = "$after" ]; then
  pass "7b. Failure reporting" "exit 1, status \`failed\`, error \`${err4:0:120}\`, failures $f0 → $f1; no record closed or changed"
else
  fail "7b. Failure reporting" "exit $(cat "$OUT/run4.exit"), status \`${st4:-?}\`, failures $f0 → $f1, records before \`$before\` after \`$after\`"
fi

{
  echo
  echo "Step 5 is a simulated amendment: one stored deadline was falsified locally and the live source corrected it."
  echo "Step 7b made the official host unreachable on the test machine only (hosts file); the portal itself was not affected."
  echo
  echo "**Result: $([ $FAILS = 0 ] && echo "all checks passed on live data" || echo "$FAILS check(s) failed")**"
} >> "$REPORT"
cat "$REPORT"
exit $([ $FAILS = 0 ] && echo 0 || echo 1)
