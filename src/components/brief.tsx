/** Concrete brief (18 Oct 2026): time left, what to do now, and the «Νέα για εσάς» feed. Display only. */
import Link from "next/link";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import { nextActionOf, timeLeftOf, type BriefInput, type TimeLeft } from "@/lib/site/brief";
import type { FeedItem } from "@/lib/site/feed";
import type { ListedOpportunity } from "@/lib/site/listing";
import { displayTitle } from "@/lib/site/verified";
import { formatDay } from "@/lib/format";
import { Icon } from "./icons";

export function timeLeftText(t: TimeLeft, s: SiteCopy, l: Locale): { text: string; sub?: string; tone: "urgent" | "soon" | "calm" | "muted" } {
  const b = s.brief;
  switch (t.kind) {
    case "days_left": return { text: b.daysLeft(t.days), sub: b.until(formatDay(t.until, l) ?? ""), tone: t.urgent ? "urgent" : "soon" };
    case "last_day": return { text: b.lastDay, sub: b.until(formatDay(t.until, l) ?? ""), tone: "urgent" };
    case "opens_in": return { text: b.opensIn(t.days), sub: b.on(formatDay(t.on, l) ?? ""), tone: "soon" };
    case "rolling": return { text: b.rolling, tone: "calm" };
    case "no_deadline_recorded": return { text: b.noDeadline, tone: "muted" };
    case "check_status": return { text: b.checkStatus, tone: "muted" };
    case "passed": return { text: b.passed, tone: "muted" };
    case "closed": return { text: b.closed, tone: "muted" };
  }
}

/** Small "N days left" pill for cards — only when there is a real countdown. */
export function TimeLeftPill({ input, s, locale, now }: { input: BriefInput; s: SiteCopy; locale: Locale; now: Date }) {
  const t = timeLeftOf(input, now);
  if (t.kind !== "days_left" && t.kind !== "last_day" && t.kind !== "opens_in") return null;
  const x = timeLeftText(t, s, locale);
  return <span className={`time-left tl-${x.tone}`}><Icon name="calendar" size={14} />{x.text}</span>;
}

/** «Με μια ματιά» box at the top of a detail page. */
export function OpportunityBrief({ input, what, who, s, locale, now, applyUrl, guideHref, similarHref }: {
  input: BriefInput; what: React.ReactNode; who: string; s: SiteCopy; locale: Locale; now: Date;
  applyUrl: string; guideHref?: string; similarHref: string;
}) {
  const b = s.brief;
  const t = timeLeftOf(input, now);
  const tl = timeLeftText(t, s, locale);
  const action = nextActionOf(input, now);
  return (
    <section className="brief" aria-label={b.title}>
      <div><span className="brief-k">{b.what}</span><span className="brief-v">{what}</span></div>
      <div><span className="brief-k">{b.who}</span><span className="brief-v">{who}</span></div>
      <div><span className="brief-k">{b.when}</span><span className={`brief-v tl-text tl-${tl.tone}`}>{tl.text}{tl.sub ? <span className="muted"> · {tl.sub}</span> : null}</span></div>
      <div className="brief-next">
        <span className="brief-k">{b.next}</span>
        <span className="brief-v"><strong>{b.actions[action]}</strong></span>
        <span className="row" style={{ gap: 8 }}>
          {action === "see_similar"
            ? <Link className="btn btn-ghost btn-sm" href={similarHref}>{b.similarCta} →</Link>
            : <>
                {guideHref && <Link className="btn btn-ghost btn-sm" href={guideHref}><Icon name="book" size={14} />{b.guideCta}</Link>}
                <a className="btn btn-primary btn-sm" href={applyUrl} target="_blank" rel="noopener noreferrer">{b.applyCta} <Icon name="external" size={14} /></a>
              </>}
        </span>
      </div>
    </section>
  );
}

type Feed = { opened: FeedItem<ListedOpportunity>[]; closing: FeedItem<ListedOpportunity>[]; changed: FeedItem<ListedOpportunity>[] };

export function FeedPanel({ feed, s, locale, title, per = 4 }: { feed: Feed; s: SiteCopy; locale: Locale; title: string; per?: number }) {
  const f = s.feed;
  const col = (label: string, items: FeedItem<ListedOpportunity>[], when: (d: string) => string, icon: string, href: string) => (
    <div className="feed-col">
      <h3><Icon name={icon} size={18} />{label} <span className="muted">· {items.length}</span></h3>
      {items.length === 0 ? <p className="small muted" style={{ margin: 0 }}>{f.none}</p> : (
        <ul>
          {items.slice(0, per).map(({ item, at }) => {
            const tt = displayTitle(item.row, locale);
            return (
              <li key={item.row.id}>
                <Link href={`/opportunities/${item.row.id}`} lang={tt.lang}>{tt.text}</Link>
                <span className="xs muted">{when(formatDay(at, locale) ?? "")} · {s.scope[item.scope]}</span>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > per && <Link href={href} className="xs">{f.more(items.length - per)} →</Link>}
    </div>
  );
  return (
    <section className="feed" aria-label={title}>
      <div className="feed-head"><h2>{title}</h2><p className="small muted">{f.lead}</p></div>
      <div className="feed-grid">
        {col(f.closing, feed.closing, f.closesOn, "calendar", "/opportunities?status=open")}
        {col(f.opened, feed.opened, f.openedOn, "sparkle", "/opportunities")}
        {col(f.changed, feed.changed, f.changedOn, "alert", "/opportunities")}
      </div>
      <p className="xs muted" style={{ margin: 0 }}>{f.rules} {f.noAuto}</p>
    </section>
  );
}
