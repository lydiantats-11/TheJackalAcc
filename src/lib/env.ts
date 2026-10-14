import { z } from "zod";

/** Server-side environment. Never import this from client components. */
const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5-5"),
  /** Extraction stays OFF until the owner approves the cost: set to "true" explicitly. */
  AI_EXTRACTION_ENABLED: z.enum(["true", "false"]).default("false"),
  /** Hard monthly cap in USD (Anthropic bills in USD). Extraction is skipped safely when it would be exceeded. */
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(0),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  MONITOR_CONTACT_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function env(): Env {
  if (!cached) {
    // Treat empty strings as "not set" so .env.example placeholders do not pass validation.
    const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
    cached = schema.parse(raw);
  }
  return cached;
}

export function requireDatabaseUrl(): string {
  const url = env().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  return url;
}
