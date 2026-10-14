"use server";
// Server actions. Next.js rejects cross-origin action POSTs (Origin vs Host check), which provides CSRF protection.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { AuthError, registerUser, verifyLogin } from "@/lib/auth/service";
import { clientIp, currentUser, endSession, requireUser, startSession } from "@/lib/auth/session";
import { deleteMyAccount, toggleSaved, updateProfile } from "@/lib/data/user";
import { setSourceEnabled } from "@/lib/data/admin";
import { runSource } from "@/lib/ingestion/worker";
import { env } from "@/lib/env";

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const u = await verifyLogin(sql(), { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }, await clientIp());
    await startSession(u.id);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.code };
    throw e;
  }
  redirect("/dashboard");
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const locale = (await cookies()).get("lang")?.value === "en" ? "en" : "el";
    const u = await registerUser(sql(), { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), locale });
    await startSession(u.id);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.code };
    throw e;
  }
  redirect("/profile?welcome=1");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function setLocaleAction(form: FormData): Promise<void> {
  const lang = form.get("lang") === "en" ? "en" : "el";
  (await cookies()).set("lang", lang, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  const u = await currentUser();
  if (u) await sql()`UPDATE users SET locale = ${lang} WHERE id = ${u.id}`;
  revalidatePath("/", "layout");
}

const multi = (form: FormData, key: string): string[] | null => {
  const v = form.getAll(key).map(String).filter(Boolean);
  return v.length ? v : null;
};
/** Persona/interest chips are always in the form, so an empty selection is a real answer ("none"), not "not asked". */
const chips = (form: FormData, key: string): string[] => [...new Set(form.getAll(key).map(String).filter(Boolean))];
const single = (form: FormData, key: string): string | null => {
  const v = form.get(key);
  return typeof v === "string" && v !== "" ? v : null;
};

const amount = (form: FormData, key: string): number | "not_sure" | "prefer_not" | null => {
  const mode = single(form, `${key}_mode`);
  if (mode === "not_sure" || mode === "prefer_not") return mode;
  if (mode !== "amount") return null;
  const n = Number(single(form, key));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * True when the submitted form actually contained this field. Checkbox groups send nothing when nothing is ticked,
 * so the form declares them with a hidden `__present` input; amount fields arrive as `<name>_mode`.
 */
const sent = (form: FormData, key: string): boolean =>
  form.has(key) || form.has(`${key}_mode`) || form.getAll("__present").map(String).includes(key);

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const birth = single(form, "birth_year");
  try {
    const answers: Record<string, unknown> = {
      persona: single(form, "persona"),
      personas: chips(form, "personas"),
      interests: chips(form, "interests"),
      housing_status: single(form, "housing_status"),
      first_home_purchase: single(form, "first_home_purchase"),
      household_size: single(form, "household_size"),
      dependent_children: single(form, "dependent_children"),
      household_income_range: single(form, "household_income_range"),
      property_owned: single(form, "property_owned"),
      application_country: "GR",
      tax_residence_country: single(form, "tax_residence_country"),
      region_codes: multi(form, "region_codes"),
      willing_to_relocate: single(form, "willing_to_relocate"),
      age_range: single(form, "age_range"),
      birth_year: birth ? Number(birth) : null,
      employment_status: single(form, "employment_status"),
      dypa_registered: single(form, "dypa_registered"),
      education_level: single(form, "education_level"),
      sectors: multi(form, "sectors"),
      business_stage: single(form, "business_stage"),
      legal_form: single(form, "legal_form"),
      business_registration_date: single(form, "business_registration_date"),
      business_region: single(form, "business_region"),
      employees_range: single(form, "employees_range"),
      turnover_range: single(form, "turnover_range"),
      own_contribution_range: single(form, "own_contribution_range"),
      project_budget_eur: amount(form, "project_budget_eur"),
      planned_project_start: single(form, "planned_project_start"),
      de_minimis_received_3y_eur: amount(form, "de_minimis_received_3y_eur"),
      balance_sheet_range: single(form, "balance_sheet_range"),
      enterprise_relationship: single(form, "enterprise_relationship"),
      public_ownership_25: single(form, "public_ownership_25"),
      municipality: single(form, "municipality"),
      has_consortium_partners: single(form, "has_consortium_partners"),
    };
    // Write only what this form sent; application_country is fixed by the product, not asked.
    const patch = Object.fromEntries(Object.entries(answers).filter(([k]) => k === "application_country" || sent(form, k)));
    await updateProfile(sql(), user, patch);
  } catch {
    return { error: "invalid_input" };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleSaveAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get("opportunity_id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await toggleSaved(sql(), user, id);
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteAccountAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const confirm = String(form.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== "DELETE" && confirm !== "ΔΙΑΓΡΑΦΗ") redirect("/profile?delete=confirm");
  await endSession();
  await deleteMyAccount(sql(), user);
  redirect("/?deleted=1");
}

export async function toggleSourceAction(form: FormData): Promise<void> {
  const user = await currentUser();
  const res = await setSourceEnabled(sql(), user, String(form.get("source_id")), form.get("enabled") === "true");
  revalidatePath("/admin/sources");
  if (!res.ok) redirect(`/admin/sources?error=${res.reason}`);
}

/** Admin: run a source once now ("test"). A successful test moves a configured source to "tested". Audited. */
export async function testSourceAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/dashboard?denied=1");
  const sourceId = String(form.get("source_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) redirect("/admin/sources?error=not_found");
  const r = await runSource(sql(), sourceId, { trigger: "test", triggeredBy: user.id, contactEmail: env().MONITOR_CONTACT_EMAIL });
  await sql()`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
              VALUES (${user.id}, 'source_test_run', 'source', ${sourceId}, ${sql().json({ status: r.status, run_id: r.run_id } as never)})`;
  revalidatePath("/admin/sources");
  redirect(`/admin/sources?${r.status === "succeeded" || r.status === "partial" ? "ok=test_ok" : `error=${r.status === "no_adapter" ? "no_automated_adapter" : "test_failed"}`}`);
}

// ── AI extraction review (admin only; every action audited in the data layer) ──
import { approveCandidate, attachOfficialDocument, rejectCandidate, setCompleteness } from "@/lib/data/review";
import { runExtraction } from "@/lib/ai/extraction";
import { configuredProvider } from "@/lib/ai";

const uuid = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export async function approveCandidateAction(form: FormData): Promise<void> {
  const id = uuid(form.get("candidate_id"));
  const rank = Number(form.get("evidence_rank")) as 1 | 2 | 3;
  const r = id ? await approveCandidate(sql(), await currentUser(), id, { evidenceRank: [1, 2, 3].includes(rank) ? rank : 2, note: String(form.get("note") ?? "") || undefined })
               : { ok: false as const, reason: "not_found" };
  revalidatePath("/admin/review");
  redirect(`/admin/review?${r.ok ? "ok=approved" : `error=${r.reason}`}`);
}

export async function rejectCandidateAction(form: FormData): Promise<void> {
  const id = uuid(form.get("candidate_id"));
  const note = String(form.get("note") ?? "").trim() || "rejected";
  const r = id ? await rejectCandidate(sql(), await currentUser(), id, note) : { ok: false as const, reason: "not_found" };
  revalidatePath("/admin/review");
  redirect(`/admin/review?${r.ok ? "ok=rejected" : `error=${r.reason}`}`);
}

export async function setCompletenessAction(form: FormData): Promise<void> {
  const id = uuid(form.get("opportunity_id"));
  const v = form.get("value") === "complete" ? "complete" : "partial";
  if (id) await setCompleteness(sql(), await currentUser(), id, v);
  revalidatePath("/admin/review");
  redirect("/admin/review?ok=completeness");
}

export async function extractDocumentAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/dashboard?denied=1");
  const id = uuid(form.get("opportunity_id"));
  const url = String(form.get("url") ?? "");
  if (!id || !url.startsWith("https://")) redirect("/admin/review?error=invalid_input");
  const provider = configuredProvider();
  if (!provider) redirect("/admin/review?error=ai_disabled");
  let status = "failed";
  try {
    const docId = await attachOfficialDocument(sql(), user, id, url);
    const r = await runExtraction(sql(), { opportunityId: id, documentId: docId, provider, monthlyBudgetUsd: env().AI_MONTHLY_BUDGET_USD });
    status = r.status;
  } catch (e) {
    status = "document_error";
  }
  revalidatePath("/admin/review");
  redirect(`/admin/review?${status === "succeeded" ? "ok=extracted" : `error=${status}`}`);
}
