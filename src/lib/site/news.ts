/**
 * «Νέα» (owner decision, 22 Oct 2026): news are not opportunities; they are what changes (laws, arrangements, circulars).
 *  - Each OFFICIAL SOURCE RECORD is stored once (issuer, document, date, link, deadline, how it was checked).
 *  - Each ARTICLE belongs to exactly one path and is written for that audience; it points to a source record and never
 *    copies its facts. Where the same law concerns both audiences there are two articles over ONE source record, so a
 *    change in the law is corrected in one place.
 * Content comes only from docs/research/REGULATORY_UPDATES_2026-10-20.md, items labelled "manually verified" (the
 * official text was read). Items known only by title, or with no official link recorded, are not published.
 */
import type { Locale } from "@/lib/i18n/dictionaries";
import type { Audience } from "./audience";

type L = Record<Locale, string>;

export interface NewsSource {
  id: string;
  issuer: L;
  /** The official document as it is cited. */
  document: string;
  /** Date of the document (YYYY-MM-DD). */
  date: string;
  url: string;
  scope: "gr" | "eu";
  /** A date people must act by, when the document sets one (YYYY-MM-DD). */
  deadline: string | null;
  /** When the document applies from, when it says so (YYYY-MM-DD). */
  effective: string | null;
  verification: "manually_verified";
  checkedOn: string;
}

export interface NewsArticle {
  id: string;
  audience: Audience;
  source: string;
  title: L;
  summary: L;
  tags: L[];
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "aade-e2060-2026",
    issuer: { el: "ΑΑΔΕ", en: "AADE (Independent Authority for Public Revenue)" },
    document: "Εγκύκλιος Ε.2060/12-10-2026 (άρθρο 19 ν.5313/2026· Α.1141/2026)",
    date: "2026-10-12",
    url: "https://www.aade.gr/sites/default/files/2026-10/ADA%20E2060.pdf",
    scope: "gr", deadline: "2026-12-31", effective: null,
    verification: "manually_verified", checkedOn: "2026-10-20",
  },
  {
    id: "aade-a1210-2026",
    issuer: { el: "ΑΑΔΕ", en: "AADE (Independent Authority for Public Revenue)" },
    document: "Α.1210/07-10-2026, ΦΕΚ Β' 6220/13-10-2026",
    date: "2026-10-07",
    url: "https://www.aade.gr/sites/default/files/2026-10/ADA%20A1210.pdf",
    scope: "gr", deadline: null, effective: "2026-10-13",
    verification: "manually_verified", checkedOn: "2026-10-20",
  },
];

const debts: L = { el: "Οφειλές", en: "Debts" };

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: "e2060-citizen", audience: "citizen", source: "aade-e2060-2026",
    title: { el: "Ρύθμιση έως 72 δόσεων για παλιά χρέη στην εφορία", en: "Up to 72 instalments for old tax debts" },
    summary: {
      el: "Για οφειλές που ήταν ληξιπρόθεσμες έως 31/12/2023 σε ΔΟΥ, ΚΕΜΕΦ, ΚΕΒΕΙΣ ή τελωνεία. Χρειάζεται να έχετε υποβάλει τις δηλώσεις φορολογίας εισοδήματος των τελευταίων 5 ετών. Ελάχιστη δόση €30 τον μήνα. Αίτηση στο myAADE › Ρυθμίσεις Οφειλών.",
      en: "For debts overdue by 31/12/2023 with a tax office, KEMEF, KEVEIS or customs. You need to have filed your income tax returns for the last 5 years. Minimum instalment €30 a month. Apply in myAADE › Debt arrangements.",
    },
    tags: [debts],
  },
  {
    id: "e2060-business", audience: "business", source: "aade-e2060-2026",
    title: { el: "Ρύθμιση έως 72 δόσεων και για νομικά πρόσωπα", en: "Up to 72 instalments, legal entities included" },
    summary: {
      el: "Ισχύει για φυσικά και νομικά πρόσωπα, για οφειλές ληξιπρόθεσμες έως 31/12/2023 (ΔΟΥ, ΚΕΜΕΦ, ΚΕΒΕΙΣ, τελωνεία). Εξαιρούνται οφειλές που ήταν σε ρύθμιση στις 21/04/2026 και η ανάκτηση κρατικών ενισχύσεων της ΕΕ. Προϋπόθεση: δηλώσεις φορολογίας εισοδήματος 5 ετών. Ελάχιστη δόση €30.",
      en: "Applies to individuals and legal entities, for debts overdue by 31/12/2023 (tax office, KEMEF, KEVEIS, customs). Debts under an arrangement on 21/04/2026 and recovery of EU state aid are excluded. Condition: income tax returns for the last 5 years filed. Minimum instalment €30.",
    },
    tags: [debts],
  },
  {
    id: "a1210-business", audience: "business", source: "aade-a1210-2026",
    title: { el: "Νέο αρμόδιο όργανο για οφειλές από δάνεια με εγγύηση της Αναπτυξιακής Τράπεζας", en: "New competent body for debts from loans guaranteed by the Hellenic Development Bank" },
    summary: {
      el: "Αρμόδιος γίνεται ο προϊστάμενος της ΔΟΥ (ή της μονάδας είσπραξης, όπου είναι από κοινού αρμόδια). Δεν αλλάζουν δικαιούχοι, δόσεις ή προθεσμίες.",
      en: "The head of the tax office (or of the collection unit, where jointly competent) becomes responsible. Eligibility, instalments and deadlines do not change.",
    },
    tags: [debts],
  },
];

export const newsSource = (id: string) => NEWS_SOURCES.find((x) => x.id === id);

/** The news of one path, newest first, each with its official source record. */
export function newsOf(aud: Audience): Array<{ article: NewsArticle; source: NewsSource }> {
  return NEWS_ARTICLES.filter((a) => a.audience === aud)
    .map((article) => ({ article, source: newsSource(article.source)! }))
    .filter((x) => !!x.source)
    .sort((a, b) => b.source.date.localeCompare(a.source.date));
}
