import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "../actions";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  const { t } = await getDict();
  return (
    <>
      <h1>{t.auth.login}</h1>
      <AuthForm action={loginAction} errors={t.auth.errors} autoCompletePassword="current-password"
        labels={{ email: t.auth.email, password: t.auth.password, submit: t.auth.login, switchText: t.auth.noAccount, switchLink: t.auth.register, switchHref: "/register" }} />
    </>
  );
}
