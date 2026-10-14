import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProfile, listSavedIds } from "@/lib/data/user";
import { listOpportunities, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { assess, rankKey } from "@/lib/domain/eligibility";
import { isAnswered } from "@/lib/domain/personas";
import { AvailabilityBadge, EligibilityBadge, SyntheticLabel } from "@/components/badges";
import { deadlineText } from "@/components/opportunity-facts";

export const metadata = { title: "Dashboard" };
const PROFILE_FIELDS = ["personas", "persona", "region_codes", "age_range", "employment_status", "education_level", "sectors", "business_stage", "own_contribution_range"] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const [profile, rows, savedIds] = await Promise.all([getProfile(sql(), user), listOpportunities(sql()), listSavedIds(sql(), user)]);
  const reqs = await loadRequirements(sql(), rows.map((r) => r.id));
  const now = new Date();
  const filled = PROFILE_FIELDS.filter((f) => isAnswered(profile[f])).length;
  const pct = Math.round((filled / PROFILE_FIELDS.length) * 100);

  const ranked = rows
    .map((o) => ({ o, a: assess(toMatchable(o, reqs.get(o.id) ?? []), profile, { now }) }))
    .filter(({ a }) => a.availability !== "closed" && a.availability !== "closed_budget_exhausted")
    .sort((x, y) => rankKey(x.a) - rankKey(y.a));
  const saved = rows.filter((o) => savedIds.includes(o.id));
  const questions = [...new Set(ranked.filter(({ a }) => a.eligibility !== "unlikely_eligible" && a.eligibility !== "ineligible_verified").flatMap(({ a }) => a.questions))];

  return (
    <div className="stack">
      <h1>{t.dash.title}</h1>
      {(await searchParams).denied && <div className="notice bad">{t.dash.denied}</div>}

      <div className="grid3">
        <div className="card">
          <div className="kpi-label">{t.dash.completeness}</div>
          <div className="kpi">{pct}%</div>
          <div className="meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          {pct < 100 && <p className="small"><Link href="/profile">{t.dash.completeProfile} →</Link></p>}
        </div>
        <div className="card">
          <div className="kpi-label">{t.opp.questions}</div>
          {questions.length === 0 ? <p className="muted">—</p> : (
            <ul className="small" style={{ paddingLeft: 18, margin: "8px 0" }}>{questions.slice(0, 6).map((q) => <li key={q}>{t.question[q] ?? q}</li>)}</ul>
          )}
        </div>
        <div className="card">
          <div className="kpi-label">{t.dash.saved}</div>
          {saved.length === 0 ? <p className="muted small">{t.dash.noSaved}</p> : (
            <ul className="small" style={{ paddingLeft: 18, margin: "8px 0" }}>{saved.map((o) => <li key={o.id}><Link href={`/opportunities/${o.id}`}>{o.official_title}</Link></li>)}</ul>
          )}
        </div>
      </div>

      <h2>{t.dash.matches}</h2>
      <p className="small muted">{t.dash.note}</p>
      <ul className="opp-list">
        {ranked.map(({ o, a }) => (
          <li key={o.id} className="opp">
            <div className="row">
              <EligibilityBadge status={a.eligibility} t={t} />
              <AvailabilityBadge value={a.availability} t={t} />
              {o.is_synthetic && <SyntheticLabel t={t} />}
              <span className="spacer" />
              <span className="small muted">{t.opp.relevance}: <strong>{a.relevance_score ?? "—"}</strong> · {t.opp.coverage}: {Math.round(a.evidence_coverage * 100)}% · {t.opp.unresolved}: {a.unresolved_count}</span>
            </div>
            <h3><Link href={`/opportunities/${o.id}`}>{o.official_title}</Link></h3>
            <div className="small muted">{t.opp.deadline}: {deadlineText(o, t, locale)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
