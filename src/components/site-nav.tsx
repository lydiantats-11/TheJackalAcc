"use client";
/**
 * Primary navigation (owner decision, 22 Oct 2026). Inside a path the same five sections are shown in both paths;
 * before a path is chosen (home page, shared pages) only «Τι είναι το Jackal» is offered, so nothing about
 * opportunities, news or guides is shown until the visitor chooses. The path comes from the address.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { audienceFromSlug, paths, switchHref, type Audience, type Section } from "@/lib/site/audience";

export interface NavLabels {
  nav: Record<Section, string>;
  lookingAs: string;
  change: string;
  changeAria: Record<Audience, string>;
  short: Record<Audience, string>;
}

const SECTIONS: Section[] = ["opportunities", "news", "guides", "about", "account"];
const hrefOf = (a: Audience, s: Section) =>
  s === "opportunities" ? paths.opportunities(a) : s === "news" ? paths.news(a) : s === "guides" ? paths.guides(a) : s === "about" ? paths.about(a) : paths.account(a);

export function useAudience(): Audience | null {
  const path = usePathname() ?? "/";
  return audienceFromSlug(path.split("/")[1]);
}

export function NavLinks({ labels }: { labels: NavLabels }) {
  const path = usePathname() ?? "/";
  const a = useAudience();
  if (!a) return <Link href="/about" aria-current={path === "/about" ? "page" : undefined}>{labels.nav.about}</Link>;
  return (
    <>
      {SECTIONS.map((s) => {
        const href = hrefOf(a, s);
        const current = path === href || path.startsWith(`${href}/`);
        return <Link key={s} href={href} aria-current={current ? "page" : undefined}>{labels.nav[s]}</Link>;
      })}
    </>
  );
}

/** «Ψάχνω ως: Πολίτης — Αλλαγή»: same section in the other path, no filters carried over. */
export function PathSwitch({ labels }: { labels: NavLabels }) {
  const path = usePathname() ?? "/";
  const a = useAudience();
  const to = switchHref(path);
  if (!a || !to) return null;
  const other: Audience = a === "citizen" ? "business" : "citizen";
  return (
    <span className="path-switch">
      <span className="muted-on-dark">{labels.lookingAs}</span>
      <strong>{labels.short[a]}</strong>
      <Link href={to} aria-label={labels.changeAria[other]}>{labels.change}</Link>
    </span>
  );
}

/** A slim bar under the header, inside a path only: which path you are in and how to change it (desktop and phone). */
export function PathBar({ labels }: { labels: NavLabels }) {
  const a = useAudience();
  if (!a) return null;
  return (
    <div className="path-bar">
      <div className="container"><PathSwitch labels={labels} /></div>
    </div>
  );
}
