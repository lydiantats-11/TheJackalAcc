import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { logoutAction, setLocaleAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Funding Radar", template: "%s · Funding Radar" },
  description: "Official Greek and EU funding opportunities with transparent eligibility matching.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getDict();
  const user = await currentUser().catch(() => null);
  return (
    <html lang={locale}>
      <body>
        <a href="#content" className="skip">Skip to content</a>
        <header className="site">
          <div className="container bar">
            <Link href="/" className="logo"><span className="logo-mark" aria-hidden="true" />{t.brand}</Link>
            <nav className="main" aria-label="Main">
              <Link href="/opportunities">{t.nav.opportunities}</Link>
              {user && <Link href="/dashboard">{t.nav.dashboard}</Link>}
              {user && <Link href="/profile">{t.nav.profile}</Link>}
              {user?.role === "admin" && <Link href="/admin">{t.nav.admin}</Link>}
            </nav>
            <form action={setLocaleAction} className="lang" aria-label="Language">
              <button name="lang" value="el" aria-pressed={locale === "el"}>EL</button>
              <button name="lang" value="en" aria-pressed={locale === "en"}>EN</button>
            </form>
            {user ? (
              <form action={logoutAction}><button className="linkbtn">{t.nav.logout}</button></form>
            ) : (
              <div className="row">
                <Link href="/login" className="linkbtn">{t.nav.login}</Link>
                <Link href="/register" className="btn btn-primary btn-sm">{t.nav.register}</Link>
              </div>
            )}
          </div>
        </header>
        <main id="content"><div className="container">{children}</div></main>
        <footer className="site"><div className="container">{t.disclaimer}</div></footer>
      </body>
    </html>
  );
}
