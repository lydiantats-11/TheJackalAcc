/** The person's own decision record for one opportunity (core capability 2). Shown only to the signed-in person. */
import type { DecisionRecord } from "@/lib/domain/decision-record";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import { StateBadge } from "./badges";
import { Icon } from "./icons";

function answerText(v: unknown, s: SiteCopy): string {
  if (v === null || v === undefined || v === "") return s.audit.notAnswered;
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : s.audit.notAnswered;
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
}

export function DecisionRecordView({ record, s, t, opportunityId }: { record: DecisionRecord; s: SiteCopy; t: Dictionary; opportunityId: string }) {
  const a = s.audit;
  return (
    <details className="audit">
      <summary><Icon name="shield" size={16} /> {a.title}</summary>
      <p className="small muted">{a.lead}</p>
      <dl className="facts-grid" style={{ marginBottom: 12 }}>
        <div><dt>{a.outcome}</dt><dd>{a.classes[record.outcome_class]}<div className="xs muted" style={{ marginTop: 4 }}>{a.certainty[record.outcome_certainty]}</div></dd></div>
        <div><dt>{a.reference}</dt><dd><code>{record.reference}</code></dd></div>
        <div><dt>{a.engine}</dt><dd>{record.engine_version} · {a.decidedBy} {record.decided_by_rule}</dd></div>
        <div><dt>{a.completeness}</dt><dd>{a.completenessValues[record.requirement_set_completeness] ?? record.requirement_set_completeness}</dd></div>
      </dl>
      {record.lines.length > 0 && (
        <div className="scroll">
          <table className="crit">
            <thead><tr><th>{a.cols.requirement}</th><th>{a.cols.source}</th><th>{a.cols.type}</th><th>{a.cols.answers}</th><th>{a.cols.outcome}</th></tr></thead>
            <tbody>
              {record.lines.map((l) => (
                <tr key={l.requirement_id}>
                  <td className="small"><span lang={l.official_lang}>{l.official_text}</span>{l.interpretation && <div className="xs muted" style={{ marginTop: 4 }}>{l.interpretation}</div>}</td>
                  <td className="small">
                    <a href={l.source_url} target="_blank" rel="noopener noreferrer">{(() => { try { return new URL(l.source_url).hostname; } catch { return l.source_url; } })()} ↗</a>
                    <div className="xs muted">{l.verified_at ? `${a.verified} ${l.verified_at.slice(0, 10)} · ` : ""}{a.rank} {l.evidence_rank}/4</div>
                  </td>
                  <td className="small">{s.detail.req.kinds[l.rule_type] ?? l.rule_type}{l.authoritative ? " ✓" : ""}</td>
                  <td className="small">
                    {l.profile_fields.length === 0 ? <span className="muted">{a.noAnswers}</span> : (
                      <ul className="plain">{l.profile_fields.map((f) => <li key={f}><span className="muted">{t.question[f] ?? f}:</span> {answerText(l.answers_used[f], s)}</li>)}</ul>
                    )}
                  </td>
                  <td><StateBadge state={l.outcome} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="xs muted" style={{ margin: "10px 0 0" }}>{a.reproducible}</p>
      <p className="small" style={{ margin: "6px 0 0" }}><a href={`/opportunities/${opportunityId}/decision`} download>{a.download}</a></p>
    </details>
  );
}
