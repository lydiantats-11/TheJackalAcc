"use client";
/** Primary navigation links; marks the current section with aria-current. */
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname() ?? "/";
  return (
    <>
      {items.map((i) => {
        const current = path === i.href || path.startsWith(`${i.href}/`) || (i.href === "/for-me" && (path === "/dashboard" || path === "/profile"));
        return <Link key={i.href} href={i.href} aria-current={current ? "page" : undefined}>{i.label}</Link>;
      })}
    </>
  );
}
