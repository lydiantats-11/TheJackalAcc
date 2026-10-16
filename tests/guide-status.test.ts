/**
 * Regression tests: a guide's programme status is computed from the verified dates and the live record,
 * never frozen at the 14 Oct check (bug: DiscoverEU still showed "Open" after 15 Oct 2026, 12:00 Brussels).
 */
import { describe, expect, it } from "vitest";
import { PROGRAMME_GUIDES } from "@/lib/site/guides";
import { programmeStatus, statusFromAvailability, statusFromVerified, verifiedCloses } from "@/lib/site/guide-status";
import { SITE } from "@/lib/site/copy";

const at = (iso: string) => new Date(iso);

describe("programme status on guides", () => {
  it("DiscoverEU is open before 15 Oct 2026 12:00 Brussels and passed one second after", () => {
    expect(statusFromVerified("manual:discovereu", at("2026-10-15T09:59:59Z"))).toBe("open");
    expect(statusFromVerified("manual:discovereu", at("2026-10-15T10:00:01Z"))).toBe("deadline_passed");
    expect(statusFromVerified("manual:discovereu", at("2026-10-16T08:00:00Z"))).toBe("deadline_passed");
  });

  it("DiscoverEU was not yet open before its opening time", () => {
    expect(statusFromVerified("manual:discovereu", at("2026-09-30T12:00:00Z"))).toBe("upcoming");
  });

  it("Article 21 school-meal call is open until 13 Nov 2026 18:00 Athens, then passed", () => {
    expect(statusFromVerified("manual:a21", at("2026-10-16T08:00:00Z"))).toBe("open");
    expect(statusFromVerified("manual:a21", at("2026-11-13T16:00:01Z"))).toBe("deadline_passed");
  });

  it("a date-only deadline counts the whole day as open (Athens time)", () => {
    // Student housing: recorded closed by the checker, so it stays closed whatever the date.
    expect(statusFromVerified("manual:studenthousing", at("2026-07-15T12:00:00Z"))).toBe("closed");
    const end = verifiedCloses("manual:spiti2")!;
    expect(end.toISOString()).toBe("2026-05-31T20:59:59.999Z"); // 23:59:59.999 Athens (UTC+3)
  });

  it("programmes the checker recorded as closed stay closed", () => {
    expect(statusFromVerified("manual:spiti2", at("2026-10-16T08:00:00Z"))).toBe("closed");
  });

  it("rolling programmes without a deadline stay rolling", () => {
    for (const k of ["manual:art5c", "manual:art5b", "manual:art5a", "manual:unemployment"]) {
      expect(statusFromVerified(k, at("2026-10-16T08:00:00Z"))).toBe("rolling");
      expect(statusFromVerified(k, at("2027-06-01T08:00:00Z"))).toBe("rolling");
    }
  });

  it("a rolling call with a final cut-off passes after that cut-off (EIC Accelerator, 4 Nov 2026)", () => {
    expect(statusFromVerified("manual:eic", at("2026-10-16T08:00:00Z"))).toBe("rolling");
    expect(statusFromVerified("manual:eic", at("2026-11-04T16:00:01Z"))).toBe("deadline_passed");
  });

  it("unknown records are never shown as open", () => {
    expect(statusFromVerified("manual:does-not-exist", at("2026-10-16T08:00:00Z"))).toBe("unknown");
  });

  it("the live database record wins when it gives a definite answer", () => {
    const now = at("2026-10-16T08:00:00Z");
    expect(programmeStatus("manual:a21", now, { availability: "closed", rolling: false })).toBe("closed");
    expect(programmeStatus("manual:art5c", now, { availability: "closed", rolling: true })).toBe("closed");
    expect(programmeStatus("manual:beckham", now, { availability: "open", rolling: false })).toBe("open");
    expect(programmeStatus("manual:unemployment", now, { availability: "open", rolling: true })).toBe("rolling");
  });

  it("a stale or unverified live record falls back to the verified dates", () => {
    const now = at("2026-10-16T08:00:00Z");
    expect(programmeStatus("manual:a21", now, { availability: "stale", rolling: false })).toBe("open");
    expect(programmeStatus("manual:discovereu", now, { availability: "unverified", rolling: false })).toBe("deadline_passed");
  });

  it("a live 'open' never overrides a verified deadline that has passed (a re-opening needs a new check)", () => {
    expect(programmeStatus("manual:spiti2", at("2026-10-16T08:00:00Z"), { availability: "open", rolling: false })).toBe("closed");
    expect(programmeStatus("manual:discovereu", at("2026-10-16T08:00:00Z"), { availability: "open", rolling: false })).toBe("deadline_passed");
  });

  it("maps every availability without ever turning a doubtful one into open", () => {
    expect(statusFromAvailability("deadline_passed_unconfirmed", false)).toBe("deadline_passed");
    expect(statusFromAvailability("closed_budget_exhausted", false)).toBe("closed");
    for (const a of ["stale", "unverified", "suspended", "conflicting_information"] as const) expect(statusFromAvailability(a, false)).toBeNull();
  });

  it("no guide shows an actionable status once its verified closing time has passed", () => {
    for (const g of PROGRAMME_GUIDES) {
      const closes = verifiedCloses(g.recordKey);
      if (!closes) continue;
      const after = new Date(closes.getTime() + 1000);
      expect([g.slug, programmeStatus(g.recordKey, after)]).not.toEqual([g.slug, "open"]);
      expect([g.slug, programmeStatus(g.recordKey, after)]).not.toEqual([g.slug, "rolling"]);
      expect([g.slug, programmeStatus(g.recordKey, after, { availability: "open", rolling: false })]).not.toEqual([g.slug, "open"]);
    }
  });

  it("every status has a Greek and an English label", () => {
    for (const k of ["open", "rolling", "upcoming", "deadline_passed", "closed", "unknown"] as const) {
      expect(SITE.el.guides.programmeStatus[k]).toBeTruthy();
      expect(SITE.en.guides.programmeStatus[k]).toBeTruthy();
    }
  });

  it("the guide model no longer carries a stored status", () => {
    for (const g of PROGRAMME_GUIDES) expect("status" in g).toBe(false);
  });
});
