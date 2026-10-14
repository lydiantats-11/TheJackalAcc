import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";
import { registerAction } from "../actions";

export const metadata = { title: "Sign up" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard");
  const { t } = await getDict();
  return (
    <>
      <h1>{t.auth.register}</h1>
      <AuthForm action={registerAction} errors={t.auth.errors} autoCompletePassword="new-password"
        labels={{ email: t.auth.email, password: t.auth.password, submit: t.auth.register, switchText: t.auth.haveAccount, switchLink: t.auth.login, switchHref: "/login" }} />
    </>
  );
}
