/**
 * Components for complex business grants (ΕΣΠΑ-type calls), designed on the «Ξεκινώ Επιχειρηματικά» research case
 * (17 Oct 2026). Display only: they render recorded facts with their sources and never decide eligibility.
 *   1. ChangesTimeline   — call → amendments → FAQ → deadline → results, each dated and linked
 *   2. ActivityCodes     — eligible ΚΑΔ rule, confirmed examples, status of the full list
 *   3. EligibleExpenses  — expense categories and how costs are proven
 *   4. FinancialTable    — amounts per applicant form + financial conditions
 *   5. DocumentChecklist — documents classed mandatory / conditional / on request, with references
 *   6. ProcedureSteps    — numbered application and payment steps
 */
import type { Locale } from "@/lib/i18n/dictionaries";
import { Icon } from "./icons";

type L = Record<Locale, string>;
const day = (iso: string, l: Locale) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(l === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const CG_COPY = {
  el: {
    timeline: "Χρονολόγιο αλλαγών", kad: "Επιλέξιμοι ΚΑΔ", expenses: "Επιλέξιμες δαπάνες", financial: "Οικονομικοί όροι",
    documents: "Δικαιολογητικά", procedure: "Διαδικασία αίτησης και πληρωμής", source: "Πηγή", who: "Ποιος", amount: "Ποσό", how: "Πώς καταβάλλεται",
    kinds: { call: "Πρόσκληση", opens: "Άνοιγμα", amendment: "Τροποποίηση", faq: "Συχνές ερωτήσεις", closes: "Λήξη", results: "Αποτελέσματα" } as Record<string, string>,
    classes: { mandatory: "Υποχρεωτικό", conditional: "Υπό προϋπόθεση", on_request: "Αν ζητηθεί" } as Record<string, string>,
    confirmed: "Επιβεβαιωμένα παραδείγματα", conditions: "Βασικοί όροι",
  },
  en: {
    timeline: "Changes timeline", kad: "Eligible activity codes (ΚΑΔ)", expenses: "Eligible expenses", financial: "Financial conditions",
    documents: "Documents", procedure: "Application and payment procedure", source: "Source", who: "Who", amount: "Amount", how: "How it is paid",
    kinds: { call: "Call", opens: "Opens", amendment: "Amendment", faq: "FAQ", closes: "Closes", results: "Results" } as Record<string, string>,
    classes: { mandatory: "Mandatory", conditional: "Conditional", on_request: "On request" } as Record<string, string>,
    confirmed: "Confirmed examples", conditions: "Key conditions",
  },
};

export function ChangesTimeline({ items, note, l }: { items: Array<{ date: string; kind: string; source: string } & L>; note?: L; l: Locale }) {
  const c = CG_COPY[l];
  return (
    <section className="card cg" id="timeline">
      <h2>{c.timeline}</h2>
      <ol className="cg-timeline">
        {items.map((x) => (
          <li key={`${x.date}-${x.kind}`} className={`k-${x.kind}`}>
            <span className="cg-date">{day(x.date, l)}</span>
            <span className="tag">{c.kinds[x.kind] ?? x.kind}</span>
            <p>{x[l]} <a href={x.source} target="_blank" rel="noopener noreferrer" className="xs">{c.source} ↗</a></p>
          </li>
        ))}
      </ol>
      {note && <p className="xs muted" style={{ margin: 0 }}>{note[l]}</p>}
    </section>
  );
}

export function ActivityCodes({ kad, l }: { kad: { rule: L; examples_confirmed: Array<{ code: string } & L>; sectors_named: L; full_list_status: L; warning: L }; l: Locale }) {
  const c = CG_COPY[l];
  return (
    <section className="card cg" id="kad">
      <h2>{c.kad}</h2>
      <p>{kad.rule[l]}</p>
      <div className="notice small"><Icon name="alert" size={16} /><span>{kad.full_list_status[l]}</span></div>
      <h3 className="cg-sub">{c.confirmed}</h3>
      <table className="crit"><tbody>{kad.examples_confirmed.map((k) => <tr key={k.code}><td><code>{k.code}</code></td><td>{k[l]}</td></tr>)}</tbody></table>
      <p className="small muted">{kad.sectors_named[l]}</p>
      <p className="small" style={{ margin: 0 }}><Icon name="info" size={14} /> {kad.warning[l]}</p>
    </section>
  );
}

export function EligibleExpenses({ e, l }: { e: { basis: L; items: L[]; source: string }; l: Locale }) {
  const c = CG_COPY[l];
  return (
    <section className="card cg" id="expenses">
      <h2>{c.expenses}</h2>
      <ul className="checklist">{e.items.map((x) => <li key={x.en}><Icon name="check" size={16} /><span>{x[l]}</span></li>)}</ul>
      <p className="small muted" style={{ margin: 0 }}>{e.basis[l]} <a href={e.source} target="_blank" rel="noopener noreferrer">{c.source} ↗</a></p>
    </section>
  );
}

export function FinancialTable({ f, l }: { f: { rows: Array<{ who: L; amount: string; how: L }>; conditions: L[] }; l: Locale }) {
  const c = CG_COPY[l];
  return (
    <section className="card cg" id="financial">
      <h2>{c.financial}</h2>
      <div className="scroll">
        <table className="crit">
          <thead><tr><th>{c.who}</th><th>{c.amount}</th><th>{c.how}</th></tr></thead>
          <tbody>{f.rows.map((r) => <tr key={r.who.en}><td>{r.who[l]}</td><td><strong>{r.amount}</strong></td><td>{r.how[l]}</td></tr>)}</tbody>
        </table>
      </div>
      <h3 className="cg-sub">{c.conditions}</h3>
      <ul className="checklist small">{f.conditions.map((x) => <li key={x.en}><Icon name="info" size={16} /><span>{x[l]}</span></li>)}</ul>
    </section>
  );
}

export function DocumentChecklist({ d, l }: { d: { status: L; items: Array<{ class: string; ref: string } & L>; source: string }; l: Locale }) {
  const c = CG_COPY[l];
  const order = ["mandatory", "conditional", "on_request"];
  return (
    <section className="card cg" id="documents">
      <h2>{c.documents}</h2>
      <div className="notice small"><Icon name="alert" size={16} /><span>{d.status[l]}</span></div>
      {order.map((cls) => {
        const items = d.items.filter((x) => x.class === cls);
        if (!items.length) return null;
        return (
          <div key={cls}>
            <h3 className="cg-sub"><span className={`badge ${cls === "mandatory" ? "b-info" : ""}`}>{c.classes[cls]}</span></h3>
            <ul className="checklist small">{items.map((x) => <li key={x.en}><Icon name="book" size={16} /><span>{x[l]} <span className="muted">· {x.ref}</span></span></li>)}</ul>
          </div>
        );
      })}
      <p className="xs muted" style={{ margin: 0 }}><a href={d.source} target="_blank" rel="noopener noreferrer">{c.source} ↗</a></p>
    </section>
  );
}

export function ProcedureSteps({ steps, l }: { steps: L[]; l: Locale }) {
  const c = CG_COPY[l];
  return (
    <section className="card cg" id="procedure">
      <h2>{c.procedure}</h2>
      <ol className="num-steps">{steps.map((s, i) => <li key={s.en}><span className="n" aria-hidden="true">{i + 1}</span><span>{s[l]}</span></li>)}</ol>
    </section>
  );
}
