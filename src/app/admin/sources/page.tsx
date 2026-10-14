import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { listSourceHealth } from "@/lib/data/admin";
import { formatDate } from "@/lib/format";
import { testSourceAction, toggleSourceAction } from "@/app/actions";

export const metadata = { title: "Sources" };
const TONE: Record<string, string> = { configured: "b-warn", tested: "b-info", active: "b-ok", degraded: "b-bad", inactive: "" };
const ACCESS_TONE: Record<string, string> = { verified: "b-ok", untested: "", undocumented: "b-warn", blocked_by_robots: "b-bad", inaccessible: "b-bad", unsupported: "b-bad" };

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireAdmin();
  const { t, locale } = await getDict();
  const sources = await listSourceHealth(sql(), user);
  const sp = await searchParams;
  const active = sources.filter((s) => s.lifecycle === "active").length;
  const groups: Array<[string | undefined, typeof sources]> = [
    [t.access.verified, sources.filter((s) => s.access_status === "verified")],
    [`${t.access.untested} / ${t.access.undocumented}`, sources.filter((s) => s.access_status === "untested" || s.access_status === "undocumented")],
    [`${t.access.inaccessible} / ${t.access.blocked_by_robots} / ${t.access.unsupported}`, sources.filter((s) => ["inaccessible", "blocked_by_robots", "unsupported"].includes(s.access_status))],
  ];
  return (
    <div className="stack">
      <h1>{t.admin.sources}</h1>
      <div className="notice">{t.admin.coverageNote} ({active}/{sources.length})</div>
      {sp.error && <div className="notice bad" role="alert">{t.admin.reasons[sp.error] ?? sp.error}</div>}
      {sp.ok && <div className="notice info" role="status">{t.admin.reasons[sp.ok] ?? sp.ok}</div>}
      {groups.map(([title, rows]) => rows.length > 0 && (
        <section key={title ?? ""}>
          <h2>{title} ({rows.length})</h2>
          <div className="card scroll">
            <table className="crit">
              <thead><tr><th>Source</th><th>{t.admin.lifecycle}</th><th>{t.admin.lastSuccess}</th><th>{t.admin.lastContent}</th><th>{t.admin.recentRuns}</th><th /></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="small muted">{s.scope} · {s.access_method} · {t.admin.adapter}: {s.adapter}{s.connector_version ? ` v${s.connector_version}` : ""}</div>
                      <div className="small"><a href={s.base_url} target="_blank" rel="noopener noreferrer">{new URL(s.base_url).hostname} ↗</a>
                        {s.terms_url && <> · <a href={s.terms_url} target="_blank" rel="noopener noreferrer">terms ↗</a></>}</div>
                      <div className="row small" style={{ marginTop: 4 }}>
                        <span className={`badge ${ACCESS_TONE[s.access_status] ?? ""}`}>{t.admin.access}: {t.access[s.access_status] ?? s.access_status}</span>
                        <span className="badge b-plain">{t.admin.robots}: {s.robots_status}</span>
                        <span className="badge b-plain">{t.admin.auth}: {s.auth_required}</span>
                      </div>
                      {s.compliance_notes && <details className="small muted"><summary>{t.admin.compliance}</summary>{s.compliance_notes}{s.licence_notes ? ` ${s.licence_notes}` : ""}</details>}
                      {s.last_error && <div className="small" style={{ color: "var(--bad)" }}>{s.last_error}</div>}
                    </td>
                    <td><span className={`badge ${TONE[s.lifecycle] ?? ""}`}>{t.lifecycle[s.lifecycle]}</span>
                      <div className="small muted">{t.admin.failures}: {s.consecutive_failures}</div>
                      <div className="small muted">{t.admin.interval}: {s.check_interval_minutes}</div></td>
                    <td className="small">{formatDate(s.last_success_at, locale) ?? "—"}<div className="muted">{t.admin.lastCheck}: {formatDate(s.last_check_at, locale) ?? "—"}</div></td>
                    <td className="small">{formatDate(s.last_content_at, locale) ?? "—"}<div className="muted">{t.admin.latestPublication}: {formatDate(s.latest_publication_at, locale) ?? "—"}</div></td>
                    <td className="small">{s.runs_7d} ({s.failed_runs_7d} ✕)
                      {s.last_run && <div className="muted">{s.last_run.status} · +{s.last_run.items_new} / Δ{s.last_run.items_changed} / {s.last_run.items_seen}</div>}</td>
                    <td>
                      <div className="stack">
                        {s.adapter !== "manual" && (
                          <form action={testSourceAction}><input type="hidden" name="source_id" value={s.id} /><button className="btn btn-ghost btn-sm">{t.admin.testNow}</button></form>
                        )}
                        <form action={toggleSourceAction}>
                          <input type="hidden" name="source_id" value={s.id} />
                          <input type="hidden" name="enabled" value={String(!s.enabled)} />
                          <button className="btn btn-ghost btn-sm">{s.enabled ? t.admin.disable : t.admin.enable}</button>
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
