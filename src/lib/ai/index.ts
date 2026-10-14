import { env } from "@/lib/env";
import { AnthropicProvider, type ExtractionProvider } from "./provider";

/** Returns a provider only when extraction is explicitly enabled AND a key is configured. */
export function configuredProvider(): ExtractionProvider | null {
  const e = env();
  if (e.AI_EXTRACTION_ENABLED !== "true" || !e.ANTHROPIC_API_KEY) return null;
  return new AnthropicProvider(e.ANTHROPIC_API_KEY, e.AI_MODEL);
}
