import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { SITE } from "@/lib/site/copy";
import { LogoMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { NavLinks } from "@/components/site-nav";
import { logoutAction, setLocaleAction } from "./actions";

const inter = Inter({ subsets: ["latin", "greek"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDict();
  return {
    title: { default: "Jackal Accountant", template: "%s · Jackal Accountant" },
    description: SITE[locale].meta.description,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getDict();
  const s = SITE[locale];
  const user = await currentUser().catch(() => null);
  const tagline = locale === "el" ? "Ελλάδα · ΕΕ" : "Greece · EU";
  // Five main tabs (owner decision, 17 Oct 2026). Categories stay reachable from Opportunities and the footer.
  const nav = [
    { href: "/", label: s.nav.home },
    { href: "/opportunities", label: s.nav.opportunities },
    { href: "/for-me", label: s.nav.forMe },
    { href: "/guides", label: s.nav.guides },
    { href: "/about", label: s.nav.how },
  ];
  const lang = (
    <form action={setLocaleAction} className="lang" aria-label="Language / Γλώσσα">
      <button name="lang" value="el" aria-pressed={locale === "el"}>EL</button>
      <button name="lang" value="en" aria-pressed={locale === "en"}>EN</button>
    </form>
  );
  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <a href="#content" className="skip">{locale === "el" ? "Μετάβαση στο περιεχόμενο" : "Skip to content"}</a>
        <header className="site">
          <div className="container bar">
            <Link href="/" className="logo" aria-label={s.brand}>
              <LogoMark />
              <span>{s.brand}<small>{tagline}</small></span>
            </Link>
            <nav className="main" aria-label={locale === "el" ? "Κύρια πλοήγηση" : "Main navigation"}><NavLinks items={nav} /></nav>
            <div className="header-actions">
              <span className="desktop-only">{lang}</span>
              {user?.role === "admin" && <Link href="/admin" className="linkbtn desktop-only">{s.nav.admin}</Link>}
              {user ? (
                <>
                  <Link href="/profile" className="linkbtn desktop-only">{s.nav.profile}</Link>
                  <form action={logoutAction} className="desktop-only"><button className="btn btn-ghost btn-sm">{t.nav.logout}</button></form>
                </>
              ) : (
                <>
                  <Link href="/login" className="linkbtn desktop-only">{t.nav.login}</Link>
                  <Link href="/register" className="btn btn-primary btn-sm desktop-only">{t.nav.register}</Link>
                </>
              )}
              <details className="mobile-nav">
                <summary><Icon name="menu" size={18} />{s.nav.menu}</summary>
                <div className="panel">
                  {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
                  <hr />
                  {user ? (
                    <>
                      <Link href="/profile">{s.nav.profile}</Link>
                      {user.role === "admin" && <Link href="/admin">{s.nav.admin}</Link>}
                      <form action={logoutAction}><button>{t.nav.logout}</button></form>
                    </>
                  ) : (
                    <>
                      <Link href="/login">{t.nav.login}</Link>
                      <Link href="/register">{t.nav.register}</Link>
                    </>
                  )}
                  <hr />
                  <div style={{ padding: "6px 14px" }}>{lang}</div>
                </div>
              </details>
            </div>
          </div>
        </header>
        <main id="content">{children}</main>
        <footer className="site">
          <div className="container">
            <div className="cols">
              <div>
                <Link href="/" className="logo"><LogoMark /><span>{s.brand}<small>{tagline}</small></span></Link>
                <p style={{ marginTop: 16, maxWidth: 420 }}>{s.footer.note}</p>
              </div>
              <div>
                <h3>{s.footer.explore}</h3>
                <ul>
                  <li><Link href="/opportunities">{s.nav.opportunities}</Link></li>
                  <li><Link href="/categories">{s.footer.categories}</Link></li>
                  <li><Link href="/for-me">{s.nav.forMe}</Link></li>
                  <li><Link href="/guides">{s.footer.guides}</Link></li>
                </ul>
              </div>
              <div>
                <h3>{s.footer.platform}</h3>
                <ul>
                  <li><Link href="/about">{s.footer.how}</Link></li>
                  <li><Link href="/about#faq">{s.footer.faq}</Link></li>
                  <li><Link href="/about#sources">{s.footer.sources}</Link></li>
                </ul>
              </div>
            </div>
            <div className="fine">{t.disclaimer} {s.footer.mvp}</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
