import { notFound, redirect } from "next/navigation";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { getOpportunity } from "@/lib/data/opportunities";
import { paths } from "@/lib/site/audience";

/** Old addresses keep working: they lead to the record in its own path; unclassified records are not served. */
export default async function OldOpportunity({ params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) redirect("/");
  const o = await getOpportunity(sql(), (await params).id).catch(() => null);
  if (!o?.audience) notFound();
  redirect(paths.opportunity(o.audience, o.id));
}
