/** Guides: verification badge, guide card and application-status badge (shared by the landing page and the article). */
import Link from "next/link";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import { guideCategory, type Article, type VerificationState } from "@/lib/site/guide-catalog";
import type { GuideRecordStatus } from "@/lib/site/guide-status";
import { RecordStatusBadge } from "./badges";
import { Icon } from "./icons";

const TONE: Record<VerificationState, string> = {
  verified: "b-ok", educational: "b-info", needs_reverification: "b-warn", incomplete: "b-warn", conflicting: "b-warn", draft: "",
};

export function VerificationBadge({ state, s }: { state: VerificationState; s: SiteCopy }) {
  return <span className={`badge ${TONE[state]}`} title={s.guides.stateHelp[state]}>{s.guides.states[state]}</span>;
}

/** The programme's application status on guides: the shared canonical badge (same as listings and detail pages). */
export function ApplicationBadge({ status, s, locale, detail = true }: { status: GuideRecordStatus; s: SiteCopy; locale: Locale; detail?: boolean }) {
  return <RecordStatusBadge record={status} s={s} locale={locale} detail={detail} />;
}

export function formatDay(d: string, locale: Locale, month: "short" | "long" = "short") {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", { day: "numeric", month, year: "numeric" });
}

export function GuideCard({ a, state, status, s, locale }: {
  a: Article; state: VerificationState; status: GuideRecordStatus | null; s: SiteCopy; locale: Locale;
}) {
  const cat = guideCategory(a.categories[0] ?? "");
  return (
    <article className="opp-card guide-card">
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span className="icon-tile navy" aria-hidden="true"><Icon name={cat?.icon ?? "book"} /></span>
        {status && <ApplicationBadge status={status} s={s} locale={locale} />}
      </div>
      <h3><Link href={`/guides/${a.slug}`}>{a.title[locale]}</Link></h3>
      <p className="small muted clamp-3" style={{ margin: 0 }}>{a.intro[locale]}</p>
      <div className="tags">
        {a.categories.map((c) => { const x = guideCategory(c); return x ? <span key={c} className="tag cat">{x.name[locale]}</span> : null; })}
      </div>
      <div className="foot">
        <VerificationBadge state={state} s={s} />
        {a.checkedOn && <span>{s.guides.checked(formatDay(a.checkedOn, locale))}</span>}
      </div>
    </article>
  );
}
