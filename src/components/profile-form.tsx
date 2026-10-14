"use client";
/**
 * Adaptive profile form: business, financial and personal-detail sections appear only when relevant
 * (business stage) or when an opportunity has asked for the answer (?ask=field,...).
 * Every question offers "not sure" / "prefer not to answer"; sensitive questions explain why they are asked.
 */
import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import type { MatchProfile } from "@/lib/domain/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const NUTS2_GR: Array<[string, string]> = [
  ["EL30", "Αττική / Attica"], ["EL41", "Βόρειο Αιγαίο / North Aegean"], ["EL42", "Νότιο Αιγαίο / South Aegean"], ["EL43", "Κρήτη / Crete"],
  ["EL51", "Ανατ. Μακεδονία & Θράκη / East Macedonia & Thrace"], ["EL52", "Κεντρική Μακεδονία / Central Macedonia"],
  ["EL53", "Δυτική Μακεδονία / West Macedonia"], ["EL54", "Ήπειρος / Epirus"], ["EL61", "Θεσσαλία / Thessaly"],
  ["EL62", "Ιόνια Νησιά / Ionian Islands"], ["EL63", "Δυτική Ελλάδα / Western Greece"], ["EL64", "Στερεά Ελλάδα / Central Greece"],
  ["EL65", "Πελοπόννησος / Peloponnese"],
];
const NACE: Array<[string, string]> = [
  ["A", "Agriculture"], ["C", "Manufacturing"], ["F", "Construction"], ["G", "Trade"], ["H", "Transport"], ["I", "Tourism & food service"],
  ["J", "ICT"], ["K", "Finance"], ["L", "Real estate"], ["M", "Professional / scientific"], ["P", "Education"], ["Q", "Health & social"], ["R", "Arts & sport"],
];

type T = Dictionary;
function Select({ name, label, value, options, t, extra = ["not_sure", "prefer_not"], hint, highlight, onChange }: {
  name: string; label: string | undefined; value: unknown; options: Record<string, string>; t: T; extra?: string[];
  hint?: string; highlight?: boolean; onChange?: (v: string) => void;
}) {
  return (
    <div style={highlight ? { outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 } : undefined}>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={typeof value === "string" ? value : ""} onChange={(e) => onChange?.(e.target.value)} aria-describedby={hint ? `${name}-hint` : undefined}>
        <option value="">{t.profile.notAnswered}</option>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        {extra.map((k) => <option key={k} value={k}>{t.opt[k as "not_sure" | "prefer_not"]}</option>)}
      </select>
      {hint && <p id={`${name}-hint`} className="small muted" style={{ margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

function Amount({ name, label, value, t, hint, highlight }: { name: string; label: string | undefined; value: unknown; t: T; hint?: string; highlight?: boolean }) {
  const initialMode = value === "not_sure" || value === "prefer_not" ? String(value) : typeof value === "number" ? "amount" : "";
  const [mode, setMode] = useState(initialMode);
  return (
    <div style={highlight ? { outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 } : undefined}>
      <label htmlFor={`${name}_mode`}>{label}</label>
      <div className="row">
        <select id={`${name}_mode`} name={`${name}_mode`} value={mode} onChange={(e) => setMode(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">{t.profile.notAnswered}</option>
          <option value="amount">€</option>
          <option value="not_sure">{t.opt.not_sure}</option>
          <option value="prefer_not">{t.opt.prefer_not}</option>
        </select>
        {mode === "amount" && <input name={name} type="number" min={0} step={100} inputMode="numeric" defaultValue={typeof value === "number" ? value : ""} style={{ maxWidth: 180 }} aria-label={label} />}
      </div>
      {hint && <p className="small muted" style={{ margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

export function ProfileForm({ action, profile, t, ask }: { action: (s: FormState, f: FormData) => Promise<FormState>; profile: MatchProfile; t: T; ask: string[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [stage, setStage] = useState<string>(profile.business_stage ?? "");
  const yn = { yes: t.opt.yes, no: t.opt.no };
  const regions = profile.region_codes ?? [];
  const sectors = profile.sectors ?? [];
  const isBusiness = stage === "registered_new" || stage === "established";
  const asked = (f: string) => ask.includes(f);
  const showBusiness = isBusiness || ["legal_form", "business_registration_date", "business_region", "employees_range", "turnover_range", "balance_sheet_range", "enterprise_relationship", "public_ownership_25"].some(asked);
  const showProject = ["project_budget_eur", "planned_project_start", "de_minimis_received_3y_eur"].some(asked) || profile.project_budget_eur != null || profile.planned_project_start != null;
  return (
    <form action={formAction} className="stack">
      {state?.ok && <div className="notice info" role="status">{t.profile.saved}</div>}
      {state?.error && <div className="notice bad" role="alert">{t.auth.errors.invalid_input}</div>}

      <fieldset><legend>{t.question.business_stage}</legend>
        <div className="formgrid">
          <Select name="persona" label="Persona" value={profile.persona} options={t.opt.persona} t={t} extra={[]} />
          <Select name="business_stage" label={t.question.business_stage} value={profile.business_stage} options={t.opt.business_stage} t={t} extra={["not_sure"]} onChange={setStage} highlight={asked("business_stage")} />
          <Select name="own_contribution_range" label={t.question.own_contribution_range} value={profile.own_contribution_range} options={t.opt.own_contribution_range} t={t} hint={t.why.financial} highlight={asked("own_contribution_range")} />
        </div>
      </fieldset>

      {showBusiness && (
        <fieldset><legend>{t.question.legal_form}</legend>
          <p className="small muted" style={{ marginTop: 0 }}>{t.why.business}</p>
          <div className="formgrid">
            <Select name="legal_form" label={t.question.legal_form} value={profile.legal_form} options={t.opt.legal_form} t={t} extra={["not_sure"]} highlight={asked("legal_form")} />
            <div style={asked("business_registration_date") ? { outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 } : undefined}>
              <label htmlFor="business_registration_date">{t.question.business_registration_date}</label>
              <input id="business_registration_date" name="business_registration_date" type="date" defaultValue={profile.business_registration_date && profile.business_registration_date !== "not_sure" ? profile.business_registration_date : ""} />
            </div>
            <Select name="business_region" label={t.question.business_region} value={profile.business_region} options={Object.fromEntries(NUTS2_GR)} t={t} extra={["not_sure"]} highlight={asked("business_region")} />
            <Select name="employees_range" label={t.question.employees_range} value={profile.employees_range} options={t.opt.employees_range} t={t} highlight={asked("employees_range")} />
            <Select name="turnover_range" label={t.question.turnover_range} value={profile.turnover_range} options={t.opt.turnover_range} t={t} hint={t.why.financial} highlight={asked("turnover_range")} />
            <Select name="balance_sheet_range" label={t.question.balance_sheet_range} value={profile.balance_sheet_range} options={t.opt.turnover_range} t={t} hint={t.why.financial} highlight={asked("balance_sheet_range")} />
            <Select name="enterprise_relationship" label={t.question.enterprise_relationship} value={profile.enterprise_relationship} options={t.opt.enterprise_relationship} t={t} extra={["not_sure"]} hint={t.why.sme} highlight={asked("enterprise_relationship")} />
            <Select name="public_ownership_25" label={t.question.public_ownership_25} value={profile.public_ownership_25} options={yn} t={t} extra={["not_sure"]} highlight={asked("public_ownership_25")} />
          </div>
        </fieldset>
      )}

      <fieldset><legend>{t.question.age_range} · {t.question.education_level} · {t.question.employment_status}</legend>
        <div className="formgrid">
          <Select name="age_range" label={t.question.age_range} value={profile.age_range} options={t.opt.age_range} t={t} extra={["prefer_not"]} highlight={asked("age_range")} />
          {(asked("birth_year") || profile.birth_year) && (
            <div style={{ outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 }}>
              <label htmlFor="birth_year">{t.question.birth_year}</label>
              <input id="birth_year" name="birth_year" type="number" min={1900} max={2100} defaultValue={profile.birth_year ?? ""} />
              <p className="small muted" style={{ margin: "4px 0 0" }}>{t.why.birthYear}</p>
            </div>
          )}
          <Select name="education_level" label={t.question.education_level} value={profile.education_level} options={t.opt.education_level} t={t} highlight={asked("education_level")} />
          <Select name="employment_status" label={t.question.employment_status} value={profile.employment_status} options={t.opt.employment_status} t={t} highlight={asked("employment_status")} />
          <Select name="dypa_registered" label={t.question.dypa_registered} value={profile.dypa_registered} options={yn} t={t} highlight={asked("dypa_registered")} />
        </div>
      </fieldset>

      <fieldset><legend>{t.question.region_codes}</legend>
        <div className="checks">
          <label><input type="checkbox" name="region_codes" value="GR" defaultChecked={regions.includes("GR")} /> {t.profile.anyRegion}</label>
          {NUTS2_GR.map(([c, n]) => <label key={c}><input type="checkbox" name="region_codes" value={c} defaultChecked={regions.includes(c)} /> {n}</label>)}
        </div>
        <div className="formgrid" style={{ marginTop: 12 }}>
          {(asked("municipality") || profile.municipality) && (
            <div style={{ outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 }}>
              <label htmlFor="municipality">{t.question.municipality}</label>
              <input id="municipality" name="municipality" maxLength={80} defaultValue={profile.municipality && profile.municipality !== "not_sure" ? profile.municipality : ""} />
              <p className="small muted" style={{ margin: "4px 0 0" }}>{t.why.municipality}</p>
            </div>
          )}
          {(asked("has_consortium_partners") || profile.has_consortium_partners) && (
            <Select name="has_consortium_partners" label={t.question.has_consortium_partners} value={profile.has_consortium_partners} options={yn} t={t} extra={["not_sure"]} highlight />
          )}
          <Select name="willing_to_relocate" label={t.question.willing_to_relocate} value={profile.willing_to_relocate} options={yn} t={t} extra={["not_sure"]} highlight={asked("willing_to_relocate")} />
        </div>
      </fieldset>

      <fieldset><legend>{t.question.sectors}</legend>
        <div className="checks">
          <label><input type="checkbox" name="sectors" value="*" defaultChecked={sectors.includes("*")} /> {t.profile.anySector}</label>
          {NACE.map(([c, n]) => <label key={c}><input type="checkbox" name="sectors" value={c} defaultChecked={sectors.includes(c)} /> {c} — {n}</label>)}
        </div>
      </fieldset>

      {showProject && (
        <fieldset><legend>{t.question.project_budget_eur}</legend>
          <div className="formgrid">
            <Amount name="project_budget_eur" label={t.question.project_budget_eur} value={profile.project_budget_eur} t={t} hint={t.why.financial} highlight={asked("project_budget_eur")} />
            <div style={asked("planned_project_start") ? { outline: "2px solid var(--focus)", outlineOffset: 4, borderRadius: 6 } : undefined}>
              <label htmlFor="planned_project_start">{t.question.planned_project_start}</label>
              <input id="planned_project_start" name="planned_project_start" type="date" defaultValue={profile.planned_project_start && profile.planned_project_start !== "not_sure" ? profile.planned_project_start : ""} />
            </div>
            <Amount name="de_minimis_received_3y_eur" label={t.question.de_minimis_received_3y_eur} value={profile.de_minimis_received_3y_eur} t={t} hint={t.why.financial} highlight={asked("de_minimis_received_3y_eur")} />
          </div>
        </fieldset>
      )}
      <div><button className="btn btn-primary" disabled={pending}>{t.profile.save}</button></div>
    </form>
  );
}
