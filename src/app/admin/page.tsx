import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { adminOverview } from "@/lib/data/admin";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireAdmin();
  const { t } = await getDict();
  const o = await adminOverview(sql(), user);
  const kpis: Array<[string, number]> = [
    [t.admin.overview.users, o.users], [t.admin.overview.opportunities, o.opportunities], [t.admin.overview.pending, o.pending_review],
    [t.admin.overview.synthetic, o.synthetic], [t.admin.overview.active, o.sources_active],
  ];
  return (
    <div className="stack">
      <h1>{t.admin.title}</h1>
      <div className="grid3">
        {kpis.map(([label, v]) => <div key={label} className="card"><div className="kpi-label">{label}</div><div className="kpi">{v}</div></div>)}
      </div>
      <p className="muted small">{t.admin.overview.active}: {o.sources_active} / {o.sources_total}</p>
      <div className="row">
        <Link href="/admin/sources" className="btn btn-ghost">{t.admin.sources} →</Link>
        <Link href="/admin/review" className="btn btn-ghost">{t.nav.review} →</Link>
      </div>
    </div>
  );
}
