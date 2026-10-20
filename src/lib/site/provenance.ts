/**
 * Hand-checked records: the 14 Oct 2026 manual records ("manual:<id>") and records imported from a manual review of
 * the official call documents (publication_basis = 'manual_review', e.g. the business calls of 20 Oct 2026).
 * Records collected automatically from a portal are "retrieved", never "checked".
 */
export function isHandChecked(o: { external_key: string | null; publication_basis?: string | null }): boolean {
  return !!o.external_key?.startsWith("manual:") || o.publication_basis === "manual_review";
}
