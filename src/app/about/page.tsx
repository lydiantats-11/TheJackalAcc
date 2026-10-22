import { titled } from "@/lib/site/page-title";
import { AboutView } from "@/components/about-view";

export const generateMetadata = titled(({ s }) => s.paths.nav.about);

export default function AboutPage() {
  return <AboutView aud={null} />;
}
