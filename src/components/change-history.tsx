/** Change history of a record (core capability 3). Built only from logged versions and events. */
import type { HistoryEntry } from "@/lib/data/opportunities";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import { formatDate } from "@/lib/format";

const eur = (n: number, l: Locale) => new Intl.NumberFormat(l === "el" ? "el-GR" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function ChangeHistory({ entries, s, locale }: { entries: HistoryEntry[]; s: SiteCopy; locale: Locale }) {
  const h = s.history;
  const real = entries.filter((e) => e.kind !== "created");
  return (
    <section id="history" className="card">
      <h2 style={{ marginTop: 0 }}>{h.title}</h2>
      <p className="small muted" style={{ marginTop: 0 }}>{h.lead}</p>
      {real.length === 0 ? <p className="small" style={{ margin: 0 }}>{h.none}</p> : (
        <ol className="timeline small">
          {real.map((e, i) => (
            <li key={`${e.kind}-${e.at.getTime()}-${i}`}>
              <time dateTime={e.at.toISOString()}>{formatDate(e.at, locale)}</time>
              <strong>{h.kinds[e.kind] ?? e.kind}</strong>
              {e.fields && e.fields.length > 0 && <span> — {e.fields.map((f) => h.fields[f] ?? f).join(", ")}</span>}
              {e.budget_before != null && e.budget_after != null && e.budget_before !== e.budget_after && <span className="muted"> ({eur(e.budget_before, locale)} → {eur(e.budget_after, locale)})</span>}
            </li>
          ))}
        </ol>
      )}
      {entries.some((e) => e.kind === "created") && (
        <p className="xs muted" style={{ margin: "10px 0 0" }}>{h.kinds.created}: {formatDate(entries.filter((e) => e.kind === "created").at(-1)!.at, locale)}</p>
      )}
    </section>
  );
}
