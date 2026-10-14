import { getDict } from "@/lib/i18n/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/user";
import { ProfileForm } from "@/components/profile-form";
import { deleteAccountAction, saveProfileAction } from "../actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string; ask?: string }> }) {
  const user = await requireUser();
  const { t } = await getDict();
  const sp = await searchParams;
  const profile = await getProfile(sql(), user);
  return (
    <div className="stack">
      <h1>{t.profile.title}</h1>
      <p className="muted">{t.profile.intro}</p>
      <ProfileForm action={saveProfileAction} profile={profile} t={t} ask={(sp.ask ?? "").split(",").filter(Boolean).slice(0, 20)} />
      <h2>{t.profile.privacy}</h2>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>{user.email}</p>
        <a className="btn btn-ghost btn-sm" href="/api/me/export" style={{ width: "fit-content" }}>{t.profile.export}</a>
        <form action={deleteAccountAction} className="row">
          <div style={{ minWidth: 240 }}>
            <label htmlFor="confirm">{t.profile.deleteConfirm}</label>
            <input id="confirm" name="confirm" autoComplete="off" aria-invalid={sp.delete === "confirm"} />
          </div>
          <button className="btn btn-danger btn-sm" style={{ alignSelf: "end" }}>{t.profile.delete}</button>
        </form>
      </div>
    </div>
  );
}
