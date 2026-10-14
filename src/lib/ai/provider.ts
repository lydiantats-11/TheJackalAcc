/**
 * AI provider abstraction. The platform depends only on this interface; swapping vendors means one new class.
 * The provider receives UNTRUSTED document text and returns JSON that is validated afterwards — never trusted.
 */
export interface ExtractionRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface ExtractionResponse {
  json: unknown;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ExtractionProvider {
  name: string;
  model: string;
  extract(req: ExtractionRequest): Promise<ExtractionResponse>;
}

export class ProviderUnavailableError extends Error {}

/**
 * Anthropic Messages API with JSON-schema structured output (`output_config.format`).
 * Docs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 * NOT exercised in this workspace: it needs an API key and the owner's cost approval.
 */
export class AnthropicProvider implements ExtractionProvider {
  name = "anthropic";
  constructor(private apiKey: string, public model: string, private fetchImpl: typeof fetch = fetch) {}

  async extract(req: ExtractionRequest): Promise<ExtractionResponse> {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          output_config: { format: { type: "json_schema", schema: req.schema } },
        }),
      });
    } catch (e) {
      throw new ProviderUnavailableError(`network: ${(e as Error).message}`);
    }
    if (res.status === 429 || res.status >= 500) throw new ProviderUnavailableError(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens: number; output_tokens: number }; error?: { message: string };
    };
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${body.error?.message ?? "unknown"}`);
    const text = body.content?.find((b) => b.type === "text")?.text ?? "";
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { json, stopReason: body.stop_reason ?? "unknown", usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 } };
  }
}
