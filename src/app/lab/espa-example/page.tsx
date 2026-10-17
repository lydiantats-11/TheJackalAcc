/**
 * RESEARCH ONLY (owner approval 17 Oct 2026): a design test of the complex-grant components with the
 * «Ξεκινώ Επιχειρηματικά» research data. Not an approved opportunity, not imported, not listed, not indexed.
 * Available only when RESEARCH_LAB_ENABLED=true (private preview builds); otherwise 404.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import data from "../../../../data/research/espa-xekino-2026-10-17.json";
import { ActivityCodes, ChangesTimeline, DocumentChecklist, EligibleExpenses, FinancialTable, ProcedureSteps } from "@/components/complex-grant";

export const metadata: Metadata = { title: "Research example", robots: { index: false, follow: false } };

export default async function EspaExample() {
  if (process.env.RESEARCH_LAB_ENABLED !== "true") notFound();
  const { locale: l } = await getDict();
  const p = data.programme;
  return (
    <div className="container">
      <div className="notice bad" role="note" style={{ marginBottom: 16 }}>
        {l === "el"
          ? "Ερευνητικό παράδειγμα για τον σχεδιασμό — ΔΕΝ είναι εγκεκριμένη ευκαιρία και δεν εμφανίζεται στις Ευκαιρίες. Τα στοιχεία διαβάστηκαν στις 17/10/2026 και δεν έχουν ελεγχθεί πλήρως."
          : "Research example for design — NOT an approved opportunity and not listed in Opportunities. Facts read on 17/10/2026, not fully checked."}
      </div>
      <header className="detail-head">
        <div className="tags" style={{ marginBottom: 12 }}>
          <span className="badge">{p.status[l]}</span>
          <span className="tag">{l === "el" ? "Επιχορήγηση" : "Grant"}</span>
          <span className="tag navy">{l === "el" ? "Ελλάδα" : "Greece"}</span>
        </div>
        <h1>{p.title[l]}</h1>
        <p className="muted" style={{ margin: 0 }}>{p.programme[l]} · {p.body[l]} · <a href={p.page} target="_blank" rel="noopener noreferrer">{l === "el" ? "Επίσημη σελίδα" : "Official page"} ↗</a></p>
      </header>
      <nav className="toc">
        <a href="#financial">{l === "el" ? "Οικονομικοί όροι" : "Financial"}</a><a href="#expenses">{l === "el" ? "Δαπάνες" : "Expenses"}</a>
        <a href="#kad">ΚΑΔ</a><a href="#documents">{l === "el" ? "Δικαιολογητικά" : "Documents"}</a>
        <a href="#procedure">{l === "el" ? "Διαδικασία" : "Procedure"}</a><a href="#timeline">{l === "el" ? "Χρονολόγιο" : "Timeline"}</a>
      </nav>
      <div className="stack-lg" style={{ maxWidth: 900 }}>
        <FinancialTable f={data.financial} l={l} />
        <EligibleExpenses e={data.expenses} l={l} />
        <ActivityCodes kad={data.kad} l={l} />
        <DocumentChecklist d={data.documents} l={l} />
        <ProcedureSteps steps={data.procedure} l={l} />
        <ChangesTimeline items={data.timeline} note={data.timeline_note} l={l} />
      </div>
    </div>
  );
}
