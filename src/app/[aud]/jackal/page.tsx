import { titled } from "@/lib/site/page-title";
import { AboutView } from "@/components/about-view";
import { audienceParam } from "@/lib/site/path-params";

export const generateMetadata = titled(({ s }) => s.paths.nav.about);

export default async function PathAboutPage({ params }: { params: Promise<{ aud: string }> }) {
  return <AboutView aud={await audienceParam(params)} />;
}
