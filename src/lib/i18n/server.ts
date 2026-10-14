import "server-only";
import { cookies } from "next/headers";
import { dictionaries, type Locale } from "./dictionaries";
import { currentUser } from "@/lib/auth/session";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  if (c === "el" || c === "en") return c;
  const u = await currentUser().catch(() => null);
  return u?.locale ?? "el";
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
