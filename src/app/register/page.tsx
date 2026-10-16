import { redirect } from "next/navigation";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { AcropolisArt, LogoMark } from "@/components/brand";
import { SITE } from "@/lib/site/copy";
import { registerAction } from "../actions";

export const generateMetadata = titled(({ t }) => t.nav.register);

export default async function RegisterPage() {
  if (await currentUser()) redirect("/for-me");
  const { t, locale } = await getDict();
  const s = SITE[locale];
  return (
    <div className="container">
      <div className="auth-wrap">
        <div className="side">
          <LogoMark size={42} />
          <p>{s.auth.side}</p>
          <AcropolisArt className="art" label={locale === "el" ? "Η Ακρόπολη της Αθήνας" : "The Acropolis of Athens"} />
          <span className="small" style={{ opacity: .85 }}>{s.auth.sideNote}</span>
        </div>
        <div className="form">
      <h1>{t.auth.register}</h1>
      <AuthForm action={registerAction} errors={t.auth.errors} autoCompletePassword="new-password"
        labels={{ email: t.auth.email, password: t.auth.password, submit: t.auth.register, switchText: t.auth.haveAccount, switchLink: t.auth.login, switchHref: "/login" }} />
        </div>
      </div>
    </div>
  );
}
