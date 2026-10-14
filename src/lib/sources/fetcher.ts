/**
 * Safe outbound fetcher used by every source adapter.
 *  - HTTPS only, host must be in the source's allow-list (no arbitrary URLs → SSRF guard)
 *  - DNS results pointing at private / loopback / link-local addresses are refused
 *  - redirects are followed manually and re-validated at every hop
 *  - response size and time are bounded
 *  - transient failures are retried with bounded exponential backoff + jitter
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export class FetchPolicyError extends Error {}
export class TransientFetchError extends Error {}
export class PermanentFetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface FetchPolicy {
  allowedHosts: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

export interface FetchedResource {
  url: string; // final URL after redirects
  status: number;
  contentType: string | null;
  body: Buffer;
  fetchedAt: Date;
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export function assertAllowedUrl(raw: string, allowedHosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchPolicyError(`invalid URL: ${raw}`);
  }
  if (url.protocol !== "https:") throw new FetchPolicyError(`only https is allowed: ${raw}`);
  if (url.username || url.password) throw new FetchPolicyError("credentials in URL are not allowed");
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`)))
    throw new FetchPolicyError(`host not in source allow-list: ${host}`);
  if (net.isIP(host)) throw new FetchPolicyError("IP-literal hosts are not allowed");
  return url;
}

async function assertPublicDns(host: string): Promise<void> {
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch (err) {
    throw new TransientFetchError(`DNS lookup failed for ${host}: ${(err as NodeJS.ErrnoException).code ?? "error"}`);
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address)))
    throw new FetchPolicyError(`host resolves to a non-public address: ${host}`);
}

export interface SafeRequestInit {
  method?: "GET" | "POST";
  body?: FormData | string;
  headers?: Record<string, string>;
}

export async function safeFetch(raw: string, policy: FetchPolicy, fetchImpl: typeof fetch = fetch, init: SafeRequestInit = {}): Promise<FetchedResource> {
  const { timeoutMs = 20_000, maxBytes = 15 * 1024 * 1024, maxRedirects = 5 } = policy;
  let current = assertAllowedUrl(raw, policy.allowedHosts);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (fetchImpl === fetch) await assertPublicDns(current.hostname);
    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: init.method ?? "GET",
        body: init.body,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": policy.userAgent ?? "FundingRadarMonitor/0.1", accept: "*/*", ...(init.headers ?? {}) },
      });
    } catch (err) {
      throw new TransientFetchError(`network error: ${(err as Error).message}`);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new PermanentFetchError("redirect without location", res.status);
      if ((init.method ?? "GET") !== "GET") throw new PermanentFetchError(`unexpected redirect on ${init.method}`, res.status);
      current = assertAllowedUrl(new URL(loc, current).toString(), policy.allowedHosts);
      continue;
    }
    if (res.status === 429 || res.status >= 500) throw new TransientFetchError(`HTTP ${res.status}`);
    if (res.status >= 400) throw new PermanentFetchError(`HTTP ${res.status}`, res.status);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new PermanentFetchError(`response too large: ${declared} bytes`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > maxBytes) throw new PermanentFetchError(`response too large: ${body.length} bytes`);
    return { url: current.toString(), status: res.status, contentType: res.headers.get("content-type"), body, fetchedAt: new Date() };
  }
  throw new PermanentFetchError("too many redirects");
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY: RetryOptions = { retries: 3, baseDelayMs: 2_000, maxDelayMs: 60_000 };

/** Retries only transient errors, with exponential backoff and full jitter. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = DEFAULT_RETRY): Promise<{ value: T; attempts: number }> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (err) {
      if (!(err instanceof TransientFetchError) || attempt > opts.retries) throw err;
      const cap = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
      await sleep(Math.random() * cap);
    }
  }
}
