import "server-only";
import { notFound } from "next/navigation";
import { audienceFromSlug, type Audience } from "./audience";

/** The path of a page under /[aud]/…; anything other than /politis or /epixeiriseis is a 404. */
export async function audienceParam(params: Promise<{ aud: string }>): Promise<Audience> {
  const a = audienceFromSlug((await params).aud);
  if (!a) notFound();
  return a;
}
