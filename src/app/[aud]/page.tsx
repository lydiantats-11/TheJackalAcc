import { redirect } from "next/navigation";
import { paths } from "@/lib/site/audience";
import { audienceParam } from "@/lib/site/path-params";

export default async function PathHome({ params }: { params: Promise<{ aud: string }> }) {
  redirect(paths.opportunities(await audienceParam(params)));
}
