/**
 * USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-13).
 * Prices change: re-check before approving spend. Unknown models are priced at the highest listed rate (safe side).
 */
export const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 }, // prompts ≤100K tokens; above that 0.5 / 2.5
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
const FALLBACK = { input: 10, output: 50 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  let p = PRICES_USD_PER_MTOK[model] ?? FALLBACK;
  if (model === "claude-haiku-5-5" && inputTokens > 100_000) p = { input: 0.5, output: 2.5 };
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 100_000) / 100_000;
}

/** Rough pre-call estimate: ~3.5 characters per token for mixed Greek/English text (conservative). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
