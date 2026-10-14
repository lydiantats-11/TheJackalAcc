import type { SourceAdapter } from "../types";
import { euFundingTendersAdapter } from "./eu-funding-tenders";

/**
 * Adapter registry. A source whose adapter is "manual" or missing can never be enabled or run by the worker.
 */
const manual: SourceAdapter = {
  key: "manual",
  version: "0",
  description: "No automated collection. Opportunities are entered and verified by an administrator.",
  async discover() {
    return { items: [], skipped: [], pages_fetched: 0, truncated: false };
  },
};

const registry = new Map<string, SourceAdapter>([
  [manual.key, manual],
  [euFundingTendersAdapter.key, euFundingTendersAdapter],
]);

export function getAdapter(key: string): SourceAdapter | undefined {
  return registry.get(key);
}
export function registerAdapter(adapter: SourceAdapter): void {
  registry.set(adapter.key, adapter);
}
export function listAdapters(): SourceAdapter[] {
  return [...registry.values()];
}
