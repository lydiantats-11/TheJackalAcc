import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { SITE } from "@/lib/site/copy";
import { audienceParam } from "@/lib/site/path-params";
import { newsOf } from "@/lib/site/news";
import { loadListing } from "@/lib/site/listing";
import { buildFeed } from "@/lib/site/feed";
import { loadRecentChanges } from "@/lib/data/opportunities";
import { formatDay } from "@/lib/format";
import { FeedPanel } from "@/components/brief";
import { Icon } from "@/components/icons";

export const generateMetadata = titled(({ s }) => s.paths.nav.news);

const day = (iso: string, locale: "el" | "en") => formatDay(new Date(`${iso}T12:00:00Z`), locale, "UTC") ?? iso;

/**
 * «Νέα» of ONE path: official changes written for this audience (each over a shared official source record), and what
 * opened, closes soon or changed among this path's opportunities. Nothing from the other path is read.
 */
export default async function NewsPage({ params }: { params: Promise<{ aud: string }> }) {
  const aud = await audienceParam(params);
  const { locale } = await getDict();
  const s = SITE[locale];
  const n = s.paths.news;
  const items = newsOf(aud);
  const gr = items.filter((x) => x.source.scope === "gr");
  const eu = items.filter((x) => x.source.scope === "eu");
  const list = isDatabaseConfigured() ? await loadListing(sql(), aud).catch(() => []) : [];
  const changes = isDatabaseConfigured() ? await loadRecentChanges(sql()).catch(() => []) : [];
  const feed = buildFeed(list.filter((x) => !x.row.is_synthetic), changes, new Date());

  const render = (xs: typeof items) => (
    <div className="news-list">
      {xs.map(({ article: a, source: src }) => (
        <article key={a.id} className="card news-item" data-audience={a.audience}>
          <div className="d">{day(src.date, locale)}<small>{src.issuer[locale]}</small></div>
          <div>
            <h3>{a.title[locale]}</h3>
            <p className="small">{a.summary[locale]}</p>
            <div className="tags" style={{ marginBottom: 6 }}>
              {a.tags.map((t) => <span key={t.el} className="tag">{t[locale]}</span>)}
              {src.deadline && <span className="tag gold">{n.deadline}: {day(src.deadline, locale)}</span>}
              {src.effective && <span className="tag">{n.effective}: {day(src.effective, locale)}</span>}
            </div>
            <p className="xs muted" style={{ margin: 0 }}>
              <a href={src.url} target="_blank" rel="noopener noreferrer">{n.official}: {src.document} <Icon name="external" size={12} /></a>
              {" · "}{n.label[src.verification]} · {n.checked} {day(src.checkedOn, locale)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className="container">
      <div className="page-head">
        <h1>{n.title[aud]}</h1>
        <p className="lead">{n.lead}</p>
      </div>
      <div className="with-aside-r">
        <div className="stack-lg">
          <section aria-labelledby="news-gr">
            <h2 id="news-gr" style={{ fontSize: "1.1rem" }}>{n.greece}</h2>
            {gr.length ? render(gr) : <p className="muted">{n.none}</p>}
          </section>
          {feed.total > 0 && <FeedPanel feed={feed} s={s} locale={locale} title={n.feedTitle} per={3} audience={aud} />}
        </div>
        <aside className="stack">
          <section className="card flat" aria-labelledby="news-eu">
            <h2 id="news-eu" style={{ marginTop: 0, fontSize: "1.05rem" }}>{n.eu}</h2>
            {eu.length ? render(eu) : <p className="small muted" style={{ margin: 0 }}>{n.euEmpty}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
