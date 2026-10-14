import { describe, expect, it } from "vitest";
import { canTransition, statusAfterDeadline } from "@/lib/domain/status";
import {
  assertAllowedUrl,
  FetchPolicyError,
  isPrivateAddress,
  PermanentFetchError,
  safeFetch,
  TransientFetchError,
  withRetry,
} from "@/lib/sources/fetcher";
import { canonicalizeUrl, contentFingerprint } from "@/lib/sources/types";

describe("status management", () => {
  const current = { status: "open" as const, closes_at: new Date("2026-10-01T21:00:00Z") };

  it("#4 a source outage after the deadline does not close the opportunity", () => {
    const d = statusAfterDeadline(current, { kind: "source_unavailable" });
    expect(d.status).toBe("unverified");
    expect(d.status).not.toBe("closed");
  });

  it("an unchanged page after the deadline is still not treated as confirmed closed", () => {
    expect(statusAfterDeadline(current, { kind: "no_change_found" }).status).toBe("unverified");
  });

  it("an official extension moves the call to 'extended' with the new deadline", () => {
    const newDate = new Date("2026-11-15T21:00:00Z");
    const d = statusAfterDeadline(current, { kind: "deadline_extended", newClosesAt: newDate, evidenceUrl: "https://example.org" });
    expect(d).toMatchObject({ status: "extended", closes_at: newDate });
  });

  it("illegal transitions are rejected", () => {
    expect(canTransition("archived", "open")).toBe(false);
    expect(canTransition("cancelled", "open")).toBe(false);
    expect(canTransition("closed", "extended")).toBe(true);
  });
});

describe("safe fetcher (SSRF guard)", () => {
  const policy = { allowedHosts: ["gov.gr"] };

  it("allows only https URLs on allow-listed hosts", () => {
    expect(assertAllowedUrl("https://www.gov.gr/el/x", policy.allowedHosts).hostname).toBe("www.gov.gr");
    expect(() => assertAllowedUrl("http://www.gov.gr/", policy.allowedHosts)).toThrow(FetchPolicyError);
    expect(() => assertAllowedUrl("https://evilgov.gr/", policy.allowedHosts)).toThrow(FetchPolicyError);
    expect(() => assertAllowedUrl("https://gov.gr.attacker.com/", policy.allowedHosts)).toThrow(FetchPolicyError);
    expect(() => assertAllowedUrl("https://user:pw@gov.gr/", policy.allowedHosts)).toThrow(FetchPolicyError);
    expect(() => assertAllowedUrl("https://127.0.0.1/", ["127.0.0.1"])).toThrow(FetchPolicyError);
  });

  it("recognises private and metadata addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "192.168.0.1", "172.20.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });

  it("re-validates redirects and refuses to follow them off the allow-list", async () => {
    const fake = (async () => new Response(null, { status: 302, headers: { location: "https://attacker.example/steal" } })) as typeof fetch;
    await expect(safeFetch("https://www.gov.gr/page", policy, fake)).rejects.toBeInstanceOf(FetchPolicyError);
  });

  it("classifies 5xx/429 as transient and 404 as permanent", async () => {
    const r = (status: number) => (async () => new Response("x", { status })) as typeof fetch;
    await expect(safeFetch("https://www.gov.gr/a", policy, r(503))).rejects.toBeInstanceOf(TransientFetchError);
    await expect(safeFetch("https://www.gov.gr/a", policy, r(429))).rejects.toBeInstanceOf(TransientFetchError);
    await expect(safeFetch("https://www.gov.gr/a", policy, r(404))).rejects.toBeInstanceOf(PermanentFetchError);
  });

  it("retries transient errors with bounded attempts", async () => {
    let calls = 0;
    const sleep = async () => {};
    const ok = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new TransientFetchError("flaky");
      return "done";
    }, { retries: 3, baseDelayMs: 1, maxDelayMs: 1, sleep });
    expect(ok).toEqual({ value: "done", attempts: 3 });

    calls = 0;
    await expect(withRetry(async () => { calls++; throw new TransientFetchError("down"); }, { retries: 2, baseDelayMs: 1, maxDelayMs: 1, sleep }))
      .rejects.toBeInstanceOf(TransientFetchError);
    expect(calls).toBe(3);

    calls = 0;
    await expect(withRetry(async () => { calls++; throw new PermanentFetchError("404"); }, { retries: 5, baseDelayMs: 1, maxDelayMs: 1, sleep }))
      .rejects.toBeInstanceOf(PermanentFetchError);
    expect(calls).toBe(1);
  });
});

describe("dedupe helpers", () => {
  it("canonicalises URLs so tracking params and fragments do not create duplicates", () => {
    expect(canonicalizeUrl("https://WWW.Espa.gr/el/call/?utm_source=x&b=2&a=1#top")).toBe("https://www.espa.gr/el/call?a=1&b=2");
  });

  it("fingerprints ignore whitespace and case but detect real changes", () => {
    expect(contentFingerprint("Deadline 30/10/2026\n\n ")).toBe(contentFingerprint("deadline   30/10/2026"));
    expect(contentFingerprint("Deadline 30/10/2026")).not.toBe(contentFingerprint("Deadline 30/11/2026"));
  });
});

describe("fetcher DNS handling", () => {
  it("an unresolvable host is a transient (retryable) failure, not a crash", async () => {
    await expect(safeFetch("https://does-not-exist.invalid/x", { allowedHosts: ["invalid"] })).rejects.toBeInstanceOf(TransientFetchError);
  });
});
