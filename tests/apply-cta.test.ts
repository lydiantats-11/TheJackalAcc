/**
 * Expired or closed programmes never show an application call-to-action (owner, 22 Oct 2026, sprint «credibility»).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applicationCtaAllowed } from "@/lib/site/brief";
import { recordStatus } from "@/lib/domain/record-status";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const base = { status: "open", deadline_kind: "official", last_verified_at: new Date("2026-10-20T15:30:00Z"), stale_after_hours: 168, has_conflict: false, budget_exhausted: "unknown" };

describe("application call-to-action", () => {
  it("is offered while open, rolling or upcoming, and when the status is only unconfirmed", () => {
    for (const a of ["open", "rolling", "upcoming", "unknown", null, undefined]) expect(applicationCtaAllowed(a as never)).toBe(true);
  });
  it("is never offered after the deadline, for closed or for suspended programmes", () => {
    for (const a of ["deadline_passed", "closed", "suspended"]) expect(applicationCtaAllowed(a)).toBe(false);
  });
  it("«Νέα Ευκαιρία» (deadline 21/10/2026 15:00 Athens) loses the CTA one minute after the deadline", () => {
    const o = { ...base, closes_at: new Date("2026-10-21T12:00:00Z") } as never;
    expect(applicationCtaAllowed(recordStatus(o, new Date("2026-10-21T11:59:00Z")).application)).toBe(true);
    expect(applicationCtaAllowed(recordStatus(o, new Date("2026-10-21T12:01:00Z")).application)).toBe(false);
  });
  it("a closed programme has no CTA even without a recorded deadline", () => {
    expect(applicationCtaAllowed(recordStatus({ ...base, status: "closed", closes_at: null } as never, new Date()).application)).toBe(false);
  });
  it("the programme page and the guide page both apply the rule", () => {
    const detail = read("src/app/[aud]/eukairies/[id]/page.tsx");
    expect(detail).toContain("const canApply = applicationCtaAllowed(status.application, status.display);");
    expect(detail).toContain("{canApply");
    const guide = read("src/app/[aud]/odigoi/[slug]/page.tsx");
    expect(guide).toContain("applicationCtaAllowed(status.application, status.display)");
    expect((guide.match(/a\.applyUrl && (isProcedural && )?canApply &&/g) ?? []).length).toBe(2);
    // The brief already swaps «apply» for «similar opportunities» after the deadline.
    expect(read("src/lib/site/brief.ts")).toMatch(/case "closed": case "passed": return "see_similar";/);
  });
});
