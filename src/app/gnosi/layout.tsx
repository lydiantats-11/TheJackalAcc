/**
 * Γνώση (owner, 23 Oct 2026, Phase K): one universal page for everyone — no path, sign-up or profile. It never reads
 * opportunities or news, so nothing of either path appears here.
 */
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { visibleEntries } from "@/lib/knowledge/store";
import { DraftBanner, FixtureBanner } from "@/components/knowledge";
import { KnowledgeTabs } from "@/components/knowledge-tabs";
import { SECTIONS } from "@/lib/knowledge/schema";

export default async function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const shown = visibleEntries();
  const anySynthetic = shown.some((e) => e.synthetic);
  const anyDraft = shown.some((e) => e.draftPreview);
  return (
    <div className="container kn" data-knowledge>
      {anyDraft && <DraftBanner s={s} />}
      {anySynthetic && <FixtureBanner s={s} />}
      <KnowledgeTabs label={s.knowledge.title} tabs={SECTIONS.map((x) => ({ id: x.id, name: x.name[locale] }))} />
      {children}
    </div>
  );
}
