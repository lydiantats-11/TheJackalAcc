import { notFound, redirect } from "next/navigation";
import { articleAudience, articleBySlug, isPlatformGuide } from "@/lib/site/guide-catalog";
import { paths } from "@/lib/site/audience";

/** Old guide addresses lead to the guide in its own path; platform explainers lead to «Τι είναι το Jackal». */
export default async function OldGuide({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  if (isPlatformGuide(a)) redirect("/about");
  const aud = articleAudience(a);
  if (!aud) notFound();
  redirect(paths.guide(aud, a.slug));
}
