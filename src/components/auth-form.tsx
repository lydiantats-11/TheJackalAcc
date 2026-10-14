"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions";

interface Props {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  labels: { email: string; password: string; submit: string; switchText: string; switchLink: string; switchHref: string };
  errors: Record<string, string>;
  autoCompletePassword: "current-password" | "new-password";
}

export function AuthForm({ action, labels, errors, autoCompletePassword }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card stack" style={{ maxWidth: 420 }} noValidate>
      {state?.error && <div className="notice bad" role="alert">{errors[state.error] ?? state.error}</div>}
      <div><label htmlFor="email">{labels.email}</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div><label htmlFor="password">{labels.password}</label><input id="password" name="password" type="password" minLength={10} autoComplete={autoCompletePassword} required /></div>
      <button className="btn btn-primary" disabled={pending}>{labels.submit}</button>
      <p className="small muted">{labels.switchText} <Link href={labels.switchHref}>{labels.switchLink}</Link></p>
    </form>
  );
}
