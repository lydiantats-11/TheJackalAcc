"use client";
/** The four Knowledge sections as tabs; the current one follows the address. */
import Link from "next/link";
import { usePathname } from "next/navigation";

const HREF: Record<string, string> = { lexiko: "/gnosi/lexiko", vasika: "/gnosi/vasika", "syxnes-erotiseis": "/gnosi/syxnes-erotiseis", themata: "/gnosi/themata" };

export function KnowledgeTabs({ tabs, label }: { tabs: Array<{ id: string; name: string }>; label: string }) {
  const path = usePathname() ?? "";
  return (
    <nav className="kn-tabs" aria-label={label}>
      <Link href="/gnosi" aria-current={path === "/gnosi" ? "page" : undefined}>{label}</Link>
      {tabs.map((t) => {
        const href = HREF[t.id]!;
        return <Link key={t.id} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}>{t.name}</Link>;
      })}
    </nav>
  );
}
