import type { RequirementResult } from "@/lib/domain/engine/evaluate";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { StateBadge } from "./badges";
import { isOfficialQuote } from "@/lib/site/money";

function paramsText(r: RequirementResult): string {
  const p = r.params;
  if (!p) return "";
  return Object.entries(p)
    .filter(([, v]) => v !== "-" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join(" · ");
}

export interface RequirementsCopy { state: string; needs: string; kinds: Record<string, string> }

/**
 * Every row shows the platform's evaluation AND lets the user open the official wording and its source.
 * With `copy` (design sprint) the row speaks plain language: requirement kind in words, and which profile answer
 * would resolve an unknown — instead of the engine's parameter dump (still shown when `copy` is not given).
 */
export function RequirementsTable({ results, t, copy }: { results: RequirementResult[]; t: Dictionary; copy?: RequirementsCopy }) {
  if (results.length === 0) return <p className="small muted">{t.ui.requirementsUnknown}</p>;
  return (
    <div className="scroll">
      <table className="crit stack">
        <thead><tr><th>{t.opp.sectionRequirements}</th><th>{copy?.state ?? t.admin.lifecycle}</th><th>{t.ui.conditionText}</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.requirement_id}>
              <td data-label={t.opp.sectionRequirements}>
                {t.criterion[r.category] ?? r.category}{r.kind === "mandatory" ? " *" : ""}
                <div className="small muted">{copy?.kinds[r.kind] ?? r.kind}</div>
              </td>
              <td data-label={copy?.state ?? t.admin.lifecycle}>
                <StateBadge state={r.state} t={t} />
                {copy
                  ? (r.state === "unknown" && r.question ? <div className="small muted">{copy.needs}: {t.question[r.question] ?? r.question}</div> : null)
                  : <div className="small muted">{paramsText(r)}{r.question ? ` → ${t.question[r.question] ?? r.question}` : ""}</div>}
              </td>
              <td className="small" data-label={t.ui.conditionText}>
                {isOfficialQuote(r) ? (
                  // Exact quotation: the recorded source excerpt contains this wording word for word.
                  <details>
                    <summary><span className="muted">{t.ui.officialWording}:</span> {r.original_text.length > 80 ? r.original_text.slice(0, 80) + "…" : r.original_text}</summary>
                    <blockquote lang={r.original_lang} style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>«{r.original_text}»</blockquote>
                    <a href={r.evidence.source_url} target="_blank" rel="noopener noreferrer">{t.ui.evidence}{r.evidence.location ? ` (${r.evidence.location})` : ""} ↗</a>
                  </details>
                ) : (
                  // Paraphrase: never in quotation marks, never called official wording.
                  <details data-text-kind="summary">
                    <summary><span className="muted">{t.ui.summaryLabel}:</span> {r.original_text.length > 80 ? r.original_text.slice(0, 80) + "…" : r.original_text}</summary>
                    <p lang={r.original_lang} style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{r.original_text}</p>
                    <div className="xs muted">{t.ui.summaryNote}</div>
                    {r.evidence.excerpt && <div className="muted">{t.ui.officialWording}: «{r.evidence.excerpt}»</div>}
                    <a href={r.evidence.source_url} target="_blank" rel="noopener noreferrer">{t.ui.evidence}{r.evidence.location ? ` (${r.evidence.location})` : ""} ↗</a>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
