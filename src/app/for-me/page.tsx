import Link from "next/link";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getProfile, listSavedIds } from "@/lib/data/user";
import { loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { assess, rankKey, type Assessment } from "@/lib/domain/eligibility";
import { rankQuestions } from "@/lib/domain/question-impact";
import { isAnswered } from "@/lib/domain/personas";
import { SITE } from "@/lib/site/copy";
import { displayTitle } from "@/lib/site/verified";
import { loadListing, type ListedOpportunity } from "@/lib/site/listing";
import { INTEREST_CATEGORIES } from "@/lib/site/taxonomy";
import { personasOf } from "@/lib/domain/personas";
import { EligibilityBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { OpportunityCard } from "@/components/opportunity-card";
import { FeedPanel } from "@/components/brief";
import { buildFeed } from "@/lib/site/feed";
import { loadRecentChanges } from "@/lib/data/opportunities";
import { applicantAudienceOf, personKind, splitByApplicant } from "@/lib/site/applicants";
import { isCurrent } from "@/lib/domain/record-status";

export const generateMetadata = titled(({ s }) => s.nav.forMe);

const PROFILE_FIELDS = ["personas", "interests", "industries", "persona", "region_codes", "age_range", "employment_status", "education_level", "business_stage", "housing_status"] as const;
const GROUPS = ["potentially_eligible", "potentially_eligible_verification_required", "insufficient_information", "under_review", "unlikely_eligible", "ineligible_verified"] as const;
const PER_GROUP = 6;

export default async function ForMePage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const f = s.forMe;
  const user = await currentUser().catch(() => null);
  const denied = (await searchParams).denied;

  if (!user) {
    return (
      <div className="container">
        <div className="page-head"><h1>{f.title}</h1></div>
        <div className="match-panel">
          <div>
            <h2>{f.guestTitle}</h2>
            <p>{f.guestLead}</p>
            <ul>{s.home.matchPoints.map((p) => <li key={p}><Icon name="check" size={20} />{p}</li>)}</ul>
            <div className="row" style={{ gap: 12 }}>
              <Link href="/register" className="btn btn-primary btn-lg">{f.guestCta}</Link>
              <Link href="/login" className="btn btn-on-dark btn-lg">{f.guestLogin}</Link>
            </div>
          </div>
          <div className="match-demo">
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{s.home.matchDemoTitle}</strong><span className="tag gold">{locale === "el" ? "Ενδεικτικό" : "Illustration"}</span></div>
            {(["potentially_eligible", "potentially_eligible_verification_required", "insufficient_information"] as const).map((g) => (
              <div key={g} className="item"><span className="small">{f.groupNotes[g]}</span><EligibilityBadge status={g} t={t} /></div>
            ))}
            <p className="xs muted" style={{ margin: "12px 0 0" }}>{s.home.matchDemoNote}</p>
          </div>
        </div>
        <p className="center" style={{ marginTop: 24 }}><Link href="/opportunities">{f.guestBrowse} →</Link></p>
      </div>
    );
  }

  if (!isDatabaseConfigured()) return <div className="container"><div className="notice bad">{t.noDb}</div></div>;
  const [profile, savedIds, list] = await Promise.all([getProfile(sql(), user), listSavedIds(sql(), user), loadListing(sql())]);
  const filled = PROFILE_FIELDS.filter((k) => isAnswered(profile[k])).length;
  const pct = Math.round((filled / PROFILE_FIELDS.length) * 100);
  const hasProfile = isAnswered(profile.personas) || isAnswered(profile.interests) || filled >= 2;

  // Discovery fit (ordering and selection only — never eligibility): the person's groups vs the listing's audience,
  // and their interests vs its category. With groups or interests chosen, only listings that fit them are shown here.
  const myPersonas = personasOf(profile);
  const myCats = new Set((profile.interests ?? []).flatMap((i) => INTEREST_CATEGORIES[i] ?? []));
  const fit = (x: ListedOpportunity) => (x.audiences.some((a) => myPersonas.includes(a)) ? 2 : 0) + (x.categories.some((c) => myCats.has(c)) ? 2 : 0);
  const selective = myPersonas.length > 0 || myCats.size > 0;
  // Current opportunities (open, upcoming, or awaiting a re-check — never hidden for being due a re-check).
  const candidates = list.filter((x) => isCurrent(x.record) && (!selective || fit(x) > 0));
  const reqs = await loadRequirements(sql(), candidates.map((x) => x.row.id));
  // Who may apply (legal applicant type) is separate from eligibility and relevance: an individual's personal results
  // only include programmes recorded as open to individuals; unknown applicant types are listed apart, never as matches.
  const kind = personKind(profile);
  const { personal: current, unconfirmed, otherApplicants } = splitByApplicant(candidates, (x) => applicantAudienceOf(x.row, reqs.get(x.row.id) ?? []), kind);
  const now = new Date();
  const assessed: Array<{ x: ListedOpportunity; a: Assessment }> = current
    .map((x) => ({ x, a: assess(toMatchable(x.row, reqs.get(x.row.id) ?? []), profile, { now }) }))
    .sort((p, q) => fit(q.x) - fit(p.x) || rankKey(p.a) - rankKey(q.a));
  // «Νέα για εσάς»: only the person's current, relevant programmes open to them (same split as the results below).
  const personalFeed = buildFeed(current, await loadRecentChanges(sql()).catch(() => []), now);
  const groups = GROUPS.map((g) => ({ g, items: assessed.filter(({ a }) => a.eligibility === g) })).filter((x) => x.items.length > 0);
  // Ranked by how many current opportunities each answer would help decide (ask only what matters).
  const ranked = rankQuestions(assessed.map(({ a }) => a));
  const missing = ranked.map((r) => r.question);
  const saved = list.filter((x) => savedIds.includes(x.row.id));

  // Relevance (why it is listed for you) and eligibility (what the recorded requirements say) are shown apart.
  const relevance = (x: ListedOpportunity) => {
    const reasons: string[] = [];
    if (x.audiences.some((p) => myPersonas.includes(p))) reasons.push(locale === "el" ? "ταιριάζει με όσα σας περιγράφουν" : "fits the descriptions you chose");
    if (x.categories.some((c) => myCats.has(c))) reasons.push(locale === "el" ? "ταιριάζει με τα ενδιαφέροντά σας" : "matches your interests");
    if (reasons.length === 0) reasons.push(locale === "el" ? "τρέχουσα ευκαιρία για ιδιώτες" : "a current opportunity open to individuals");
    return reasons.join(" · ");
  };
  const o = s.onboarding;
  const answerRows: Array<[string | undefined, string, string]> = [
    [t.question.personas, myPersonas.map((p) => t.opt.personas[p] ?? p).join(", "), "who"],
    [t.question.interests, [...(profile.interests ?? []).map((i) => (t.opt.interests as Record<string, string>)[i] ?? i), ...(profile.industries ?? []).map((i) => (t.opt.industries as Record<string, string>)[i] ?? i)].join(", "), "interests"],
    [t.question.employment_status, isAnswered(profile.employment_status) ? ((t.opt.employment_status as Record<string, string>)[String(profile.employment_status)] ?? (t.opt as unknown as Record<string, string>)[String(profile.employment_status)] ?? String(profile.employment_status)) : "", "work"],
    [t.question.housing_status, isAnswered(profile.housing_status) ? ((t.opt.housing_status as Record<string, string>)[String(profile.housing_status)] ?? (t.opt as unknown as Record<string, string>)[String(profile.housing_status)] ?? String(profile.housing_status)) : "", "household"],
  ];
  const requirementsLine = (a: Assessment) => {
    const met = a.results.filter((r) => r.state === "satisfied").length;
    const unknown = a.results.filter((r) => r.state === "unknown").length;
    const total = a.results.filter((r) => r.state !== "not_applicable").length;
    if (total === 0) return locale === "el" ? "Οι προϋποθέσεις δεν έχουν καταγραφεί ακόμη." : "Requirements not recorded yet.";
    return locale === "el" ? `${met} από ${total} προϋποθέσεις ικανοποιούνται${unknown ? ` · ${unknown} χωρίς απάντηση` : ""}` : `${met} of ${total} requirements met${unknown ? ` · ${unknown} unanswered` : ""}`;
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1>{f.title}</h1>
        <p className="lead">{f.lead}</p>
        {selective && <p className="small muted" style={{ margin: "8px 0 0" }}>{f.selectiveNote} <Link href="/opportunities">{s.home.allOpps} →</Link></p>}
      </div>
      {denied && <div className="notice bad" style={{ marginBottom: 16 }}>{t.dash.denied}</div>}

      <div className="with-aside">
        <aside className="stack sticky">
          <div className="card">
            <div className="kpi-label">{f.profile}</div>
            <div className="kpi">{pct}%</div>
            <div className="meter" aria-hidden="true" style={{ margin: "10px 0 14px" }}><span style={{ width: `${pct}%` }} /></div>
            <Link href="/profile" className="btn btn-ghost btn-sm btn-block">{pct < 100 ? f.completeProfile : f.editProfile}</Link>
          </div>
          <div className="card">
            <div className="kpi-label">{o.yourAnswers}</div>
            <ul className="answers-list">
              {answerRows.map(([label, value, st]) => (
                <li key={st}><span><span className="muted">{(label ?? "").replace(/[;?;]\s*$/u, "")}:</span> {value || <span className="muted">{o.none}</span>}</span><Link href={`/profile?step=${st}`} className="xs">{o.change}</Link></li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="kpi-label">{f.missing}</div>
            {missing.length === 0 ? <p className="small muted" style={{ margin: "8px 0 0" }}>—</p> : (
              <>
                <p className="xs muted" style={{ margin: "6px 0 10px" }}>{f.missingNote}</p>
                <ul className="checklist small">{ranked.slice(0, 6).map((r) => <li key={r.question}><Icon name="info" size={16} /><span>{t.question[r.question] ?? r.question} <span className="muted">· {f.unlocks(r.unlocks)}</span></span></li>)}</ul>
                <Link href={`/profile?ask=${missing.slice(0, 12).join(",")}`} className="btn btn-primary btn-sm btn-block" style={{ marginTop: 12 }}>{f.answer}</Link>
              </>
            )}
          </div>
          <div className="card">
            <div className="kpi-label">{f.saved}</div>
            {saved.length === 0 ? <p className="small muted" style={{ margin: "8px 0 0" }}>{f.noSaved}</p> : (
              <ul className="checklist small" style={{ marginTop: 10 }}>{saved.map((x) => <li key={x.row.id}><Icon name="bookmark" size={16} /><Link href={`/opportunities/${x.row.id}`} lang={displayTitle(x.row, locale).lang}>{displayTitle(x.row, locale).text}</Link></li>)}</ul>
            )}
          </div>
        </aside>

        <section>
          {!hasProfile ? (
            <div className="empty">
              <span className="icon-tile"><Icon name="user" /></span>
              <h3>{f.noProfileTitle}</h3>
              <p>{f.noProfile}</p>
              <Link href="/profile" className="btn btn-primary">{f.completeProfile}</Link>
            </div>
          ) : (
            <div className="stack-lg">
              {personalFeed.total > 0 && <FeedPanel feed={personalFeed} s={s} locale={locale} title={s.feed.title} />}
              <p className="small muted" style={{ margin: 0 }}>{t.dash.note}</p>
              {groups.map(({ g, items }) => (
                <div key={g}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{f.groups[g]} <span className="muted" style={{ fontWeight: 500 }}>· {items.length}</span></h2>
                  </div>
                  <p className="small muted" style={{ marginTop: 0 }}>{f.groupNotes[g]}</p>
                  <div className="opp-grid">
                    {items.slice(0, PER_GROUP).map(({ x, a }) => (
                      <OpportunityCard key={x.row.id} item={x} t={t} s={s} locale={locale}
                        extra={<div className="why-box"><EligibilityBadge status={a.eligibility} t={t} /><div className="why-lines"><span><strong>{o.whyRelevance}:</strong> {relevance(x)}</span><span><strong>{o.whyEligibility}:</strong> {requirementsLine(a)}</span></div></div>} />
                    ))}
                  </div>
                  {items.length > PER_GROUP && <p className="small muted" style={{ marginTop: 10 }}>{f.more(items.length - PER_GROUP)} · <Link href="/opportunities?status=open">{f.showAll}</Link></p>}
                </div>
              ))}
              {(unconfirmed.length > 0 || otherApplicants.length > 0) && (
                <details className="card flat applicant-note">
                  <summary><strong>{f.applicantTitle}</strong> <span className="muted">· {unconfirmed.length + otherApplicants.length}</span></summary>
                  <p className="small muted">{f.applicantNote(unconfirmed.length, otherApplicants.length)}</p>
                  {unconfirmed.length > 0 && (
                    <ul className="checklist small">{unconfirmed.slice(0, 8).map((x) => <li key={x.row.id}><Icon name="info" size={16} /><Link href={`/opportunities/${x.row.id}`} lang={displayTitle(x.row, locale).lang}>{displayTitle(x.row, locale).text}</Link></li>)}</ul>
                  )}
                  <p className="small" style={{ margin: "8px 0 0" }}><Link href="/opportunities">{s.home.allOpps} →</Link></p>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
