import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { Icon } from "@/components/icons";

export default async function NotFound() {
  const { locale } = await getDict();
  const s = SITE[locale];
  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="empty" style={{ marginTop: 32 }}>
        <span className="icon-tile"><Icon name="search" /></span>
        <h1 style={{ fontSize: "1.5rem" }}>{s.notFound.title}</h1>
        <p>{s.notFound.body}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/opportunities" className="btn btn-primary">{s.notFound.cta}</Link>
          <Link href="/categories" className="btn btn-ghost">{s.nav.categories}</Link>
        </div>
      </div>
    </div>
  );
}
