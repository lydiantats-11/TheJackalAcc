import type { Locale } from "./i18n/dictionaries";

export function formatDate(d: Date | null, locale: Locale, tz = "Europe/Athens"): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: tz }).format(d);
}

export function formatMoney(v: string | number | null, locale: Locale, currency = "EUR"): string | null {
  if (v === null || v === undefined) return null;
  return new Intl.NumberFormat(locale === "el" ? "el-GR" : "en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(v));
}

/** Date without time (e.g. "14 Οκτ 2026"), for "checked on" labels. */
export function formatDay(d: Date | null, locale: Locale, tz = "Europe/Athens"): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", { dateStyle: "medium", timeZone: tz }).format(d);
}

/** A time zone in words ("ώρα Ελλάδας", "Brussels time"), never an IANA code. */
export function zoneLabel(tz: string, locale: Locale): string {
  const names: Record<string, [string, string]> = {
    "Europe/Athens": ["ώρα Ελλάδας", "Greek time"],
    "Europe/Brussels": ["ώρα Βρυξελλών", "Brussels time"],
    UTC: ["ώρα UTC", "UTC"],
  };
  const n = names[tz];
  return n ? n[locale === "el" ? 0 : 1] : tz.split("/").pop()!.replace(/_/g, " ");
}
