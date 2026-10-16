import Link from "next/link";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/user";
import { SITE } from "@/lib/site/copy";
import { ProfileForm } from "@/components/profile-form";
import { Icon } from "@/components/icons";
import { deleteAccountAction, saveProfileAction } from "../actions";

export const generateMetadata = titled(({ s }) => s.nav.profile);

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string; ask?: string; welcome?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const sp = await searchParams;
  const profile = await getProfile(sql(), user);
  return (
    <div className="container">
      <div className="page-head">
        <div className="crumbs"><Link href="/for-me">{s.nav.forMe}</Link> / {s.profile.title}</div>
        <h1>{s.profile.title}</h1>
        <p className="lead">{s.profile.lead}</p>
      </div>
      <div className="with-aside-r">
        <div>
          <ProfileForm action={saveProfileAction} profile={profile} t={t} ask={(sp.ask ?? "").split(",").filter(Boolean).slice(0, 20)} />
        </div>
        <aside className="stack sticky">
          <div className="card tint">
            <span className="icon-tile"><Icon name="info" /></span>
            <h3 style={{ marginTop: 12 }}>{s.profile.side}</h3>
            <p className="small" style={{ margin: 0 }}>{s.profile.sideBody}</p>
          </div>
          <div className="card gold">
            <span className="icon-tile gold"><Icon name="shield" /></span>
            <h3 style={{ marginTop: 12 }}>{s.profile.privacy}</h3>
            <p className="small" style={{ margin: 0 }}>{s.profile.privacyBody}</p>
          </div>
          <div className="card stack">
            <h3 style={{ margin: 0 }}>{t.profile.privacy}</h3>
            <p className="small muted" style={{ margin: 0 }}>{user.email}</p>
            <a className="btn btn-ghost btn-sm" href="/api/me/export" style={{ width: "fit-content" }}>{t.profile.export}</a>
            <form action={deleteAccountAction} className="stack">
              <div>
                <label htmlFor="confirm">{t.profile.deleteConfirm}</label>
                <input id="confirm" name="confirm" autoComplete="off" aria-invalid={sp.delete === "confirm"} />
              </div>
              <button className="btn btn-danger btn-sm" style={{ width: "fit-content" }}>{t.profile.delete}</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
