import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { listPendingCandidates } from "@/lib/data/review";
import { listOpportunities } from "@/lib/data/opportunities";
import { configuredProvider } from "@/lib/ai";
import { approveCandidateAction, extractDocumentAction, rejectCandidateAction, setCompletenessAction } from "@/app/actions";

export const metadata = { title: "Review" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireAdmin();
  const { t } = await getDict();
  const sp = await searchParams;
  const [candidates, opps] = await Promise.all([listPendingCandidates(sql(), user), listOpportunities(sql())]);
  const aiOn = configuredProvider() !== null;
  const groups = new Map<string, typeof candidates>();
  for (const c of candidates) groups.set(c.opportunity_id, [...(groups.get(c.opportunity_id) ?? []), c]);
  const r = t.review;

  return (
    <div className="stack">
      <h1>{r.title}</h1>
      <p className="muted">{r.intro}</p>
      {sp.ok && <div className="notice info" role="status">{r.messages[sp.ok] ?? sp.ok}</div>}
      {sp.error && <div className="notice bad" role="alert">{r.messages[sp.error] ?? sp.error}</div>}

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>{r.extractTitle}</h2>
        {!aiOn && <div className="notice">{r.messages.ai_disabled}</div>}
        <form action={extractDocumentAction} className="formgrid">
          <div><label htmlFor="opportunity_id">{r.opportunity}</label>
            <select id="opportunity_id" name="opportunity_id" required>
              {opps.filter((o) => !o.is_synthetic).map((o) => <option key={o.id} value={o.id}>{o.official_title.slice(0, 90)}</option>)}
            </select></div>
          <div><label htmlFor="url">{r.documentUrl}</label><input id="url" name="url" type="url" placeholder="https://…" required /></div>
          <div style={{ alignSelf: "end" }}><button className="btn btn-primary" disabled={!aiOn}>{r.extract}</button></div>
        </form>
      </section>

      {groups.size === 0 && <p className="muted">{r.empty}</p>}
      {[...groups.entries()].map(([oppId, list]) => (
        <section key={oppId} className="card stack">
          <div className="row">
            <h2 style={{ margin: 0 }}>{list[0]!.official_title}</h2>
            <span className="spacer" />
            <form action={setCompletenessAction}><input type="hidden" name="opportunity_id" value={oppId} /><input type="hidden" name="value" value="complete" />
              <button className="btn btn-ghost btn-sm">{r.markComplete}</button></form>
          </div>
          {list[0]!.injection_suspected && <div className="notice bad">{r.messages.injection}</div>}
          {list[0]!.document_url && <a className="small" href={list[0]!.document_url} target="_blank" rel="noopener noreferrer">{r.source} ↗</a>}
          <div className="scroll">
            <table className="crit">
              <thead><tr><th>{r.proposal}</th><th>{r.quote}</th><th>{r.checks}</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="small">
                      <strong>{c.candidate_type === "requirement" ? `${t.criterion[c.payload.category] ?? c.payload.category} (${c.payload.kind})` : c.payload.field}</strong>
                      <div><code style={{ whiteSpace: "pre-wrap" }}>{c.candidate_type === "requirement" ? JSON.stringify(c.payload.value) : c.payload.value}</code></div>
                      {c.payload.applies_to?.length > 0 && <div className="muted">→ {c.payload.applies_to.join(", ")}</div>}
                      <div className="muted">{r.aiConfidence}: {c.payload.confidence}</div>
                    </td>
                    <td className="small"><blockquote style={{ margin: 0 }}>{c.quote}</blockquote><div className="muted">{c.payload.location}</div></td>
                    <td className="small">
                      <span className={`badge ${c.quote_verified ? "b-ok" : "b-bad"}`}>{c.quote_verified ? r.quoteFound : r.quoteMissing}</span>{" "}
                      <span className={`badge ${c.value_valid ? "b-ok" : "b-bad"}`}>{c.value_valid ? r.valueOk : r.valueBad}</span>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>{c.review_reasons.map((x) => <li key={x}>{r.reasons[x] ?? x}</li>)}</ul>
                    </td>
                    <td>
                      <div className="stack">
                        <form action={approveCandidateAction} className="stack">
                          <input type="hidden" name="candidate_id" value={c.id} />
                          <select name="evidence_rank" defaultValue="2" aria-label={r.evidenceRank}>
                            <option value="1">{r.rank1}</option><option value="2">{r.rank2}</option><option value="3">{r.rank3}</option>
                          </select>
                          <button className="btn btn-primary btn-sm" disabled={!c.quote_verified || !c.value_valid}>{r.approve}</button>
                        </form>
                        <form action={rejectCandidateAction} className="stack">
                          <input type="hidden" name="candidate_id" value={c.id} />
                          <input name="note" placeholder={r.rejectNote} maxLength={500} />
                          <button className="btn btn-ghost btn-sm">{r.reject}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
