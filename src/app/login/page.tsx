import { redirect } from "next/navigation";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { AcropolisArt, LogoMark } from "@/components/brand";
import { SITE } from "@/lib/site/copy";
import { loginAction } from "../actions";

export const generateMetadata = titled(({ t }) => t.nav.login);

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
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
      <h1>{t.auth.login}</h1>
      <AuthForm action={loginAction} errors={t.auth.errors} autoCompletePassword="current-password"
        labels={{ email: t.auth.email, password: t.auth.password, submit: t.auth.login, switchText: t.auth.noAccount, switchLink: t.auth.register, switchHref: "/register" }} />
        </div>
      </div>
    </div>
  );
}
