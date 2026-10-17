# Taxonomy proposal — needs owner approval (17 Oct 2026)

Nothing here is applied. Current categories, URLs and approved records are unchanged. Every change below is a display
mapping that can be switched on and off; no database migration is needed.

## 1. Six independent dimensions (already separate in the code, kept separate)

| Dimension | Where it lives today | Used for | Proposal |
| --- | --- | --- | --- |
| Persona (5) | `domain/personas.ts` | Relevance in «Για Εμένα» only | Unchanged |
| Category (need) | `site/taxonomy.ts` — 11 categories | Browsing | **Simplify to 8 needs (below)** |
| Opportunity type | `supportTypeOf()` — grant, loan, benefit, tax incentive, … | Filter + card tag | Add **«Δημόσια σύμβαση / Procurement»** as a type (moves «Δημόσιοι διαγωνισμοί» out of categories) |
| Industry (30) | `domain/industries.ts` | Profile answer + filter | Absorbs «Γεωργία & αλιεία» as an industry filter |
| Geography | `scopeOf()` — Ελλάδα / ΕΕ | Filter + quick views (Milestone 2) | **EU becomes geography only, not a category**; later add region when sources give it |
| Application status | `record-status.ts` | Badge + filter | Unchanged (open, upcoming, re-check, passed, closed, suspended, unknown) |

## 2. Current vs proposed public categories (opportunities)

| # | Proposed EL | Proposed EN | Description (EL) | Replaces today |
| --- | --- | --- | --- | --- |
| 1 | Εργασία & Κατάρτιση | Work & Training | Επιδόματα ανεργίας, προγράμματα απασχόλησης, κατάρτιση | `employment` + training part of `education` |
| 2 | Επιχειρηματικότητα & Χρηματοδότηση | Business & Funding | Για όσους ξεκινούν ή αναπτύσσουν επιχείρηση: επιχορηγήσεις, δάνεια, εγγυήσεις | `entrepreneurship` + `business` |
| 3 | Στέγαση | Housing | Πρώτη κατοικία, στεγαστικά επιδόματα, ενοίκιο | housing part of `housing-energy` |
| 4 | Οικογένεια & Κοινωνικές Παροχές | Family & Social Benefits | Επιδόματα παιδιών, στήριξη νοικοκυριών | `family` |
| 5 | Σπουδές & Κινητικότητα | Studies & Mobility | Φοιτητικά επιδόματα, υποτροφίες, μετακίνηση στην Ευρώπη | education part of `education` |
| 6 | Φορολογία & Κίνητρα | Tax & Incentives | Φορολογικά καθεστώτα και κίνητρα, π.χ. για όσους μεταφέρουν τη φορολογική τους κατοικία | `tax` |
| 7 | Ενέργεια & Περιβάλλον | Energy & Environment | Ενεργειακό κόστος, εξοικονόμηση, πράσινη μετάβαση | household energy part of `housing-energy` + `environment` |
| 8 | Έρευνα & Καινοτομία | Research & Innovation | Ερευνητικές προσκλήσεις, καινοτομία, ψηφιακός μετασχηματισμός | `innovation` |

**Changed from your starting list:** «Ευρωπαϊκά Προγράμματα & Κινητικότητα» is replaced by «Έρευνα & Καινοτομία»,
and mobility moves into «Σπουδές & Κινητικότητα». Why:

- An EU programme can be about any need, so EU is better as a geography filter. Most of the 1,000 imported EU calls are
  research and innovation calls, so they still need a category of their own.
- «Στέγαση & Ακίνητα» is shortened to «Στέγαση»: no property-investment records exist, and 5Α investors are under
  category 6.

**Removed as categories:** «Δημόσιοι διαγωνισμοί» becomes an opportunity type; «Γεωργία & αλιεία» becomes an industry
filter. Their records stay findable.

**Possibly missing (no records yet, so no category yet):** health and disability benefits; pensions. Add these when
verified records exist rather than showing empty categories.

## 3. Mapping of the hand-checked records (one record, several categories; no duplicates)

| Record | Today | Proposed |
| --- | --- | --- |
| DiscoverEU | Εκπαίδευση | 5 Σπουδές & Κινητικότητα |
| ESC (Ευρωπαϊκό Σώμα Αλληλεγγύης) | — (not mapped) | 5 Σπουδές & Κινητικότητα, 1 Εργασία & Κατάρτιση |
| EIC Accelerator | Επιχειρηματικότητα, Καινοτομία | 2 Επιχειρηματικότητα & Χρηματοδότηση, 8 Έρευνα & Καινοτομία |
| Άρθρα 5Γ / 5Β / 5Α | Φορολογικά κίνητρα | 6 Φορολογία & Κίνητρα (tags: μετεγκατάσταση; 5Γ εργασία, 5Β σύνταξη, 5Α επένδυση) |
| Σπίτι μου ΙΙ | Στέγαση & ενέργεια | 3 Στέγαση |
| Φοιτητικό στεγαστικό | Στέγαση & ενέργεια, Εκπαίδευση | 3 Στέγαση, 5 Σπουδές & Κινητικότητα |
| Α21 | Οικογένεια | 4 Οικογένεια & Κοινωνικές Παροχές |
| Επίδομα ανεργίας | Εργασία & ανεργία | 1 Εργασία & Κατάρτιση |
| TED | not imported (source directory) | stays out of opportunities; listed as an official source |
| Beckham Law (Spain) | not imported | stays a comparison note in the 5Γ guide only |

## 4. Guides

Guides explain processes; opportunities are programmes. They should share the same **topic** list, while guide
**formats** become a separate filter:

| Approved guide category | Kind | Proposal |
| --- | --- | --- |
| Οδηγοί Βήμα-Βήμα | format | filter «Μορφή: βήμα-βήμα» |
| Επιδόματα & Παροχές | topic | topics 1, 4 |
| Επιχειρηματικότητα & Επιδοτήσεις | topic | topic 2 (Option C below meanwhile) |
| Εργασία & Εκπαίδευση | topic | topics 1, 5 |
| Στέγαση & Ενέργεια | topic | topics 3, 7 |
| Ευρωπαϊκά Προγράμματα | geography | geography filter |
| Συχνές Ερωτήσεις & Όροι | format | filter «Μορφή: ερωτήσεις & όροι» |
| Νέα & Αλλαγές | format | filter «Μορφή: νέα» |

This would change the approved eight guide categories, so **it is only a proposal**. Until you decide, the eight stay.

## 5. Option C (approved in principle) — exact wording for confirmation

- Guide category slug stays `business-grants`, so no URL changes.
- Name: **«Επιχειρηματικότητα, Επιδοτήσεις & Φορολογικά Κίνητρα» / "Business, Grants & Tax Incentives"**.
- Description: **«Στήριξη για επιχειρήσεις και φορολογικά κίνητρα, όπως τα καθεστώτα για όσους μεταφέρουν τη φορολογική
  τους κατοικία στην Ελλάδα.» / "Support for businesses, and tax incentives such as the regimes for people moving their
  tax residence to Greece."**
- Scope: business grants, loans and incentives, and tax regimes or incentives for individuals or businesses. It does
  not cover tax filing help or general tax news.
- Assignments: 5Γ, 5Β and 5Α all move here as their primary category. 5Γ keeps «Εργασία & Εκπαίδευση» as a second
  category. 5Β leaves «Επιδόματα & Παροχές», because a tax regime is not a benefit.
- Still eight categories. If you adopt the shared topics in §4 later, these guides move to topic 6 «Φορολογία & Κίνητρα».

## 6. Search, filters, URLs and rollback

- Old category links (`/opportunities?cat=business`, `?cat=tenders`, …) keep working through an alias table that maps
  each old slug to its new category, type or industry filter. Nothing returns a 404.
- Search already matches category names in both languages (Milestone 2). New names would be added to the search text,
  with the old names kept as synonyms.
- Personas and «Για Εμένα» interests map to categories through `INTEREST_CATEGORIES`. Only that table changes.
  Eligibility is untouched.
- Rollback means switching the display mapping back. No stored data changes.
