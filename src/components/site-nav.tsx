"use client";
/**
 * Primary navigation (owner decisions, 22 and 23 Oct 2026). Five tabs: Ευκαιρίες · Νέα · Γνώση · Τι είναι το Jackal ·
 * Ο λογαριασμός μου. «Γνώση» (/gnosi) is universal — the same for both paths, no path, sign-up or profile needed.
 * Inside a path the audience tabs point to that path. On a universal page (Γνώση) they point to the path the visitor
 * last chose (remembered in a first-party cookie, no personal data); with no path chosen yet only Γνώση and «Τι είναι
 * το Jackal» are offered, so nothing audience-specific is shown before the visitor chooses.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AUDIENCE_SLUG, KNOWLEDGE_PATH, PATH_COOKIE, audienceFromSlug, paths, switchHref, type Audience, type NavItem } from "@/lib/site/audience";

export interface NavLabels {
  nav: Record<NavItem, string>;
  lookingAs: string;
  change: string;
  changeAria: Record<Audience, string>;
  short: Record<Audience, string>;
}

const ITEMS: NavItem[] = ["opportunities", "news", "knowledge", "about", "account"];
const hrefOf = (a: Audience, s: NavItem) =>
  s === "opportunities" ? paths.opportunities(a) : s === "news" ? paths.news(a) : s === "knowledge" ? KNOWLEDGE_PATH : s === "about" ? paths.about(a) : paths.account(a);

export function useAudience(): Audience | null {
  const path = usePathname() ?? "/";
  return audienceFromSlug(path.split("/")[1]);
}

export function NavLinks({ labels, lastPath = null }: { labels: NavLabels; lastPath?: Audience | null }) {
  const path = usePathname() ?? "/";
  const inPath = useAudience();
  const onKnowledge = path === KNOWLEDGE_PATH || path.startsWith(`${KNOWLEDGE_PATH}/`);
  // The root layout is not re-rendered on client navigation, so the cookie it read can be stale: also remember the
  // path chosen in this visit on the client.
  const [remembered, setRemembered] = useState<Audience | null>(lastPath);
  useEffect(() => { if (inPath) setRemembered(inPath); }, [inPath]);
  const a = inPath ?? (onKnowledge ? remembered ?? lastPath : null);
  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  if (!a) {
    return (
      <>
        <Link href={KNOWLEDGE_PATH} aria-current={current(KNOWLEDGE_PATH)}>{labels.nav.knowledge}</Link>
        <Link href="/about" aria-current={path === "/about" ? "page" : undefined}>{labels.nav.about}</Link>
      </>
    );
  }
  return (
    <>
      {ITEMS.map((s) => {
        const href = hrefOf(a, s);
        return <Link key={s} href={href} aria-current={current(href)}>{labels.nav[s]}</Link>;
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
  // Remember the chosen path for universal pages (a preference, not personal data; one year; first party).
  useEffect(() => {
    if (a) document.cookie = `${PATH_COOKIE}=${AUDIENCE_SLUG[a]}; path=/; max-age=31536000; samesite=lax`;
  }, [a]);
  if (!a) return null;
  return (
    <div className="path-bar">
      <div className="container"><PathSwitch labels={labels} /></div>
    </div>
  );
}
