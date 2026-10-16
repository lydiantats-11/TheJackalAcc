/** Page titles in the visitor's language (browser tab, bookmarks, screen readers). */
import type { Metadata } from "next";
import { getDict } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { SITE, type SiteCopy } from "./copy";

export function titled(pick: (c: { s: SiteCopy; t: Dictionary }) => string) {
  return async function generateMetadata(): Promise<Metadata> {
    const { locale, t } = await getDict();
    return { title: pick({ s: SITE[locale], t }) };
  };
}
