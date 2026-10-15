import type { RequirementResult } from "@/lib/domain/engine/evaluate";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { StateBadge } from "./badges";

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
      <table className="crit">
        <thead><tr><th>{t.opp.sectionRequirements}</th><th>{copy?.state ?? "Status"}</th><th>{t.ui.officialWording}</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.requirement_id}>
              <td>
                {t.criterion[r.category] ?? r.category}{r.kind === "mandatory" ? " *" : ""}
                <div className="small muted">{copy?.kinds[r.kind] ?? r.kind}</div>
              </td>
              <td>
                <StateBadge state={r.state} t={t} />
                {copy
                  ? (r.state === "unknown" && r.question ? <div className="small muted">{copy.needs}: {t.question[r.question] ?? r.question}</div> : null)
                  : <div className="small muted">{paramsText(r)}{r.question ? ` → ${t.question[r.question] ?? r.question}` : ""}</div>}
              </td>
              <td className="small">
                <details>
                  <summary>{r.original_text.length > 80 ? r.original_text.slice(0, 80) + "…" : r.original_text}</summary>
                  <blockquote lang={r.original_lang} style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{r.original_text}</blockquote>
                  {r.evidence.excerpt && <div className="muted">“{r.evidence.excerpt}”</div>}
                  <a href={r.evidence.source_url} target="_blank" rel="noopener noreferrer">{t.ui.evidence}{r.evidence.location ? ` (${r.evidence.location})` : ""} ↗</a>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
