/** One reusable template for every guide (programme guides, explainers and step-by-step procedures). */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { ARTICLES, articleBySlug, guideCategory, reviewDue, verificationOf, type Article } from "@/lib/site/guide-catalog";
import { programmeStatus } from "@/lib/site/guide-status";
import { loadLiveGuideRecords } from "@/lib/site/guide-live";
import { ApplicationBadge, VerificationBadge, formatDay } from "@/components/guide-ui";
import { Icon } from "@/components/icons";
import type { Locale } from "@/lib/i18n/dictionaries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { locale } = await getDict();
  const a = articleBySlug((await params).slug);
  if (!a) return {};
  return { title: a.title[locale], description: a.intro[locale], ...(a.flags.draft ? { robots: { index: false, follow: false } } : {}) };
}

/** Words in everything the reader sees, at about 200 words a minute. */
function readingMinutes(a: Article, locale: Locale): number {
  const parts = [a.title, a.intro, a.provides, a.timing, ...a.audience, ...a.eligibility, ...(a.documents ?? []), ...a.afterSubmission, ...a.mistakes,
    ...a.limitations, ...a.steps.flatMap((x) => [x.text, ...(x.details ?? [])]), ...a.faq.flatMap((f) => [f.q, f.a]), ...a.sections.flatMap((x) => [x.h, ...x.items])];
  const words = parts.filter(Boolean).map((p) => p![locale]).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const g = s.guides;
  const a = articleBySlug((await params).slug);
  if (!a) notFound();

  const now = new Date();
  const state = verificationOf(a, now);
  const live = a.recordKey ? (await loadLiveGuideRecords([a.recordKey], now)).get(a.recordKey) : undefined;
  const status = a.recordKey ? programmeStatus(a.recordKey, now, live) : null;
  const cat = guideCategory(a.categories[0] ?? "");
  const related = ARTICLES.filter((o) => o.slug !== a.slug && !o.flags.draft && (a.related.includes(o.slug) || (a.recordKey !== null && o.recordKey === a.recordKey)));
  const limitations = [
    ...a.limitations.map((l) => l[locale]),
    ...(a.flags.conflicting && a.limitations.length === 0 ? [g.limitConflicting] : []),
    ...(a.flags.incomplete ? [g.limitIncomplete] : []),
    ...(a.flags.possiblyOutdated ? [g.limitOutdated] : []),
  ];
  const isProcedural = a.kind !== "explainer";

  // Sections in reading order; empty ones are left out rather than filled with guesses.
  const sections: Array<{ id: string; title: string; body: ReactNode }> = [];
  const list = (items: string[], icon = "check") => <ul className="checklist">{items.map((x) => <li key={x}><Icon name={icon} size={18} /><span>{x}</span></li>)}</ul>;
  if (a.audience.length) sections.push({ id: "audience", title: g.sec.audience, body: list(a.audience.map((x) => x[locale]), "user") });
  if (a.provides) sections.push({ id: "provides", title: g.sec.provides, body: <p style={{ margin: 0 }}>{a.provides[locale]}</p> });
  if (a.eligibility.length) sections.push({ id: "eligibility", title: g.sec.eligibility, body: list(a.eligibility.map((x) => x[locale])) });
  if (isProcedural) sections.push({ id: "documents", title: g.sec.documents, body: a.documents?.length ? list(a.documents.map((x) => x[locale]), "clipboard") : <p className="unknown" style={{ margin: 0 }}>{g.noDocs}</p> });
  if (a.steps.length) sections.push({ id: "steps", title: g.sec.steps, body: (
    <ol className="steps-list">
      {a.steps.map((st) => (
        <li key={st.text.el}>
          <div>
            <div>{st.text[locale]}</div>
            {st.details?.length ? <ul>{st.details.map((d) => <li key={d.el}>{d[locale]}</li>)}</ul> : null}
            {!st.confirmed && <span className="awaiting">{g.awaiting}</span>}
          </div>
        </li>
      ))}
    </ol>
  ) });
  if (a.timing) sections.push({ id: "timing", title: g.sec.timing, body: <p style={{ margin: 0 }}>{a.timing[locale]}</p> });
  if (a.afterSubmission.length) sections.push({ id: "after", title: g.sec.after, body: list(a.afterSubmission.map((x) => x[locale]), "arrow") });
  if (a.mistakes.length) sections.push({ id: "mistakes", title: g.sec.mistakes, body: list(a.mistakes.map((x) => x[locale]), "alert") });
  a.sections.forEach((x, i) => sections.push({ id: `part-${i + 1}`, title: x.h[locale], body: list(x.items.map((y) => y[locale])) }));
  if (a.faq.length) sections.push({ id: "faq", title: g.sec.faq, body: <div className="faq">{a.faq.map((f) => <details key={f.q.el}><summary>{f.q[locale]}</summary><p>{f.a[locale]}</p></details>)}</div> });
  if (limitations.length) sections.push({ id: "limitations", title: g.sec.limitations, body: list(limitations, "info") });
  if (a.sources.length) sections.push({ id: "sources", title: g.sec.sources, body: (
    <ul className="checklist small">{a.sources.map((src) => <li key={src.url}><Icon name="external" size={16} /><a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a></li>)}</ul>
  ) });
  if (related.length || live) sections.push({ id: "related", title: g.sec.related, body: (
    <ul className="checklist">
      {live && <li><Icon name="arrow" size={18} /><Link href={`/opportunities/${live.id}`}>{g.record}</Link></li>}
      {related.map((r) => <li key={r.slug}><Icon name="book" size={18} /><Link href={`/guides/${r.slug}`}>{r.title[locale]}</Link></li>)}
    </ul>
  ) });

  return (
    <div className="container article">
      <div className="page-head">
        <div className="crumbs"><Link href="/guides">{g.back}</Link>{cat && <> / <Link href={`/guides?cat=${cat.slug}#results`}>{cat.name[locale]}</Link></>}</div>
        <h1>{a.title[locale]}</h1>
        <p className="lead">{a.intro[locale]}</p>
        <div className="article-meta" style={{ marginTop: 12 }}>
          <VerificationBadge state={state} s={s} />
          {status && <ApplicationBadge status={status} s={s} />}
          {a.checkedOn && <span>{g.checked(formatDay(a.checkedOn, locale, "long"))}</span>}
          <span>{g.readingTime(readingMinutes(a, locale))}</span>
        </div>
      </div>

      <div className="with-aside-r">
        <div className="prose stack-lg">
          {a.flags.draft && <div className="notice bad"><Icon name="alert" size={18} /><span>{g.draftBanner}</span></div>}
          {reviewDue(a, now) && <div className="notice"><Icon name="alert" size={18} /><span>{g.reviewDueBanner.replace("{d}", String(a.reviewAfterDays))}</span></div>}
          <div className="notice info"><Icon name="info" size={18} /><span>{g.stateHelp[state]}</span></div>
          {sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="card">
              <h2 style={{ marginTop: 0 }}>{sec.title}</h2>
              {sec.body}
            </section>
          ))}
          <p className="small muted">{g.disclaimer}</p>
          {locale === "en" && isProcedural && <p className="xs muted">{g.platformTranslation}</p>}
        </div>

        <aside className="sticky stack">
          {(isProcedural && (a.timing || a.provides || a.applyUrl || status)) && (
            <div className="card keyinfo">
              <dl>
                {status && <div><dt>{g.appStatus}</dt><dd><ApplicationBadge status={status} s={s} /></dd></div>}
                {a.kind === "programme" && <div><dt>{g.deadline}</dt><dd>{a.timing ? a.timing[locale] : <span className="unknown">{g.notStated}</span>}</dd></div>}
                {a.kind === "programme" && <div><dt>{g.amount}</dt><dd>{a.provides ? a.provides[locale] : <span className="unknown">{g.notStated}</span>}</dd></div>}
              </dl>
              <div className="stack" style={{ marginTop: 14 }}>
                {a.applyUrl && <a className="btn btn-primary btn-block" href={a.applyUrl} target="_blank" rel="noopener noreferrer">{g.apply} <Icon name="external" size={16} /></a>}
                {live && <Link className="btn btn-ghost btn-block" href={`/opportunities/${live.id}`}>{g.record}</Link>}
              </div>
            </div>
          )}
          {sections.length > 2 && (
            <nav className="card article-toc" aria-label={g.contents}>
              <h2 className="small" style={{ margin: "0 0 8px" }}>{g.contents}</h2>
              <ol>{sections.map((sec) => <li key={sec.id}><a href={`#${sec.id}`}>{sec.title}</a></li>)}</ol>
            </nav>
          )}
        </aside>
      </div>
    </div>
  );
}
