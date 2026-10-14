import type { ExtractionProvider, ExtractionRequest, ExtractionResponse } from "@/lib/ai/provider";

/** A scripted stand-in for the AI provider (tests only). Records what it was asked. */
export class FakeProvider implements ExtractionProvider {
  name = "fake";
  model = "claude-sonnet-5-5";
  calls: ExtractionRequest[] = [];
  constructor(private reply: (req: ExtractionRequest) => ExtractionResponse | Promise<ExtractionResponse>) {}
  async extract(req: ExtractionRequest) {
    this.calls.push(req);
    return this.reply(req);
  }
}

export const ok = (json: unknown, input = 20_000, output = 1_500): ExtractionResponse => ({ json, stopReason: "end_turn", usage: { inputTokens: input, outputTokens: output } });
