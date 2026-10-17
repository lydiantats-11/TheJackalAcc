/** Milestone 1: one canonical status for every page; stale records stay visible; applicant type is separate. */
import { describe, expect, it } from "vitest";
import { isConfirmedOpen, isCurrent, recordStatus } from "@/lib/domain/record-status";
import { statusGroup } from "@/lib/site/status-group";
import { applicantAudienceOf, personKind, splitByApplicant } from "@/lib/site/applicants";

const NOW = new Date("2026-10-17T12:00:00Z");
const base = { status: "open" as const, closes_at: new Date("2026-11-13T16:00:00Z"), deadline_kind: "official" as const,
  last_verified_at: new Date("2026-10-13T21:00:00Z"), stale_after_hours: 72, has_conflict: false, budget_exhausted: "no" as const };
type In = Parameters<typeof recordStatus>[0];

describe("canonical record status", () => {
  it("A21 regression: past its 3-day re-check it is «recheck», still current and listed — not hidden, not closed, not open", () => {
    const r = recordStatus(base as In, NOW);
    expect(r).toMatchObject({ application: "open", freshness: "recheck", display: "recheck" });
    expect(isCurrent(r)).toBe(true);
    expect(isConfirmedOpen(r)).toBe(false);
    expect(statusGroup(r)).toBe("recheck");
  });
  it("fresh evidence shows open; rolling shows rolling", () => {
    expect(recordStatus({ ...base, last_verified_at: new Date("2026-10-16T21:00:00Z") } as In, NOW).display).toBe("open");
    expect(recordStatus({ ...base, closes_at: null, deadline_kind: "rolling", stale_after_hours: 720 } as In, NOW).display).toBe("rolling");
  });
  it("a passed deadline is a fact, whatever the freshness", () => {
    const r = recordStatus({ ...base, closes_at: new Date("2026-10-15T10:00:00Z") } as In, NOW);
    expect(r.display).toBe("deadline_passed");
    expect(isCurrent(r)).toBe(false);
  });
  it("closed stays closed; stale is never shown as closed", () => {
    expect(recordStatus({ ...base, status: "closed" } as In, NOW).display).toBe("closed");
    expect(recordStatus(base as In, NOW).display).not.toBe("closed");
  });
  it("unverified and conflicting evidence is labelled, never open", () => {
    expect(recordStatus({ ...base, status: "unverified" } as In, NOW).display).toBe("unverified");
    expect(recordStatus({ ...base, has_conflict: true, last_verified_at: new Date("2026-10-17T00:00:00Z") } as In, NOW).display).toBe("conflicting");
    expect(recordStatus({ ...base, last_verified_at: null } as In, NOW).display).toBe("unverified");
  });
  it("upcoming stays upcoming while fresh, «recheck» when stale", () => {
    expect(recordStatus({ ...base, status: "upcoming", last_verified_at: new Date("2026-10-17T00:00:00Z") } as In, NOW).display).toBe("upcoming");
    expect(recordStatus({ ...base, status: "upcoming" } as In, NOW).display).toBe("recheck");
  });
});

describe("applicant type (who may apply) is separate from eligibility and relevance", () => {
  const eu = { external_key: "eu-topic:ERASMUS-EDU-2026-CHARTER" };
  it("hand-checked records carry their recorded applicant type; EU portal calls stay unknown", () => {
    expect(applicantAudienceOf({ external_key: "manual:unemployment" })).toBe("individuals");
    expect(applicantAudienceOf({ external_key: "manual:eic" })).toBe("both");
    expect(applicantAudienceOf(eu)).toBe("unknown");
  });
  it("a recorded applicant_type requirement decides; organisations-only is recognised", () => {
    expect(applicantAudienceOf(eu, [{ category: "applicant_type", value: { types: ["company", "nonprofit"] } }])).toBe("organisations");
    expect(applicantAudienceOf(eu, [{ category: "applicant_type", value: { types: ["natural_person"] } }])).toBe("individuals");
  });
  it("ACCEPTANCE: an unemployed person in Attica interested in benefits and grants gets no institutional or unknown-applicant call as a personal match", () => {
    const profile = { personas: ["employee_jobseeker" as const], interests: ["financial_support" as const, "entrepreneurship" as const], region_codes: ["EL30"], employment_status: "unemployed" as const, business_stage: null };
    expect(personKind(profile)).toBe("individual");
    const items = [
      { key: "manual:unemployment", reqs: [] },
      { key: "manual:a21", reqs: [] },
      { key: "eu-topic:ERASMUS-EDU-2026-CHARTER", reqs: [] },                                                      // university call, type not structured
      { key: "eu-topic:SOCPL-2026-INFO-REPR", reqs: [] },
      { key: "eu-topic:HORIZON-X", reqs: [{ category: "applicant_type", value: { types: ["company", "university"] } }] }, // institutional only
    ];
    const { personal, unconfirmed, otherApplicants } = splitByApplicant(items, (x) => applicantAudienceOf({ external_key: x.key }, x.reqs), personKind(profile));
    expect(personal.map((x) => x.key)).toEqual(["manual:unemployment", "manual:a21"]);
    expect(unconfirmed.map((x) => x.key)).toEqual(["eu-topic:ERASMUS-EDU-2026-CHARTER", "eu-topic:SOCPL-2026-INFO-REPR"]);
    expect(otherApplicants.map((x) => x.key)).toEqual(["eu-topic:HORIZON-X"]);
  });
  it("an organisation sees organisation and unknown calls, not individuals-only benefits", () => {
    const { personal, otherApplicants } = splitByApplicant(
      [{ k: "manual:a21" }, { k: "eu-topic:X" }], (x) => applicantAudienceOf({ external_key: x.k }), personKind({ personas: ["business_org"], business_stage: null }));
    expect(personal.map((x) => x.k)).toEqual(["eu-topic:X"]);
    expect(otherApplicants.map((x) => x.k)).toEqual(["manual:a21"]);
  });
});
