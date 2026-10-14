/**
 * Transparent funding arithmetic. Every result shows formula, inputs, currency, rounding and caveats.
 * The maximum award is never presented as money the user will receive.
 */
export interface FundingInputs {
  eligible_expenditure: number | null; // user's planned eligible costs
  intensity_pct: number | null;        // official aid intensity
  min_award: number | null;
  max_award: number | null;
  currency: string;
}

export interface FundingEstimate {
  computable: boolean;
  formula: string;
  steps: string[];
  estimated_award: number | null;
  own_contribution: number | null;
  currency: string;
  rounding: string;
  caveats: string[];
  missing: string[];
}

const cents = (x: number) => Math.floor(x * 100) / 100;

export function estimateAward(i: FundingInputs): FundingEstimate {
  const missing: string[] = [];
  if (i.eligible_expenditure === null) missing.push("eligible_expenditure");
  if (i.intensity_pct === null) missing.push("intensity_pct");
  const caveats = [
    "estimate_not_guarantee",
    "authority_determines_eligible_costs",
    "excludes_ineligible_costs_vat_unless_stated",
  ];
  const base = { formula: "award = min(max_award, eligible_expenditure × intensity%)", currency: i.currency, rounding: "rounded down to the cent", caveats };
  if (missing.length) return { ...base, computable: false, steps: [], estimated_award: null, own_contribution: null, missing };
  const raw = (i.eligible_expenditure! * i.intensity_pct!) / 100;
  const steps = [`${i.eligible_expenditure} × ${i.intensity_pct}% = ${cents(raw)}`];
  let award = raw;
  if (i.max_award !== null && raw > i.max_award) { award = i.max_award; steps.push(`capped at published maximum ${i.max_award}`); }
  if (i.min_award !== null && award < i.min_award) {
    steps.push(`below published minimum ${i.min_award}: project may be too small for this call`);
    caveats.push("below_minimum_award");
  }
  const own = i.eligible_expenditure! - award;
  steps.push(`own contribution = ${i.eligible_expenditure} − ${cents(award)} = ${cents(own)}`);
  return { ...base, computable: true, steps, estimated_award: cents(award), own_contribution: cents(own), missing: [] };
}
