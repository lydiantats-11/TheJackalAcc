/**
 * 18 Oct 2026 — concrete brief and «Νέα για εσάς»: countdowns come only from recorded official dates; a record that
 * needs re-checking never gets a countdown or "apply now"; the feed never treats an import date as news.
 */
import { describe, expect, it } from "vitest";
import { daysUntil, nextActionOf, timeLeftOf, type BriefInput } from "@/lib/site/brief";
import { buildFeed } from "@/lib/site/feed";
import type { RecordStatus } from "@/lib/domain/record-status";
import { SITE } from "@/lib/site/copy";

const now = new Date("2026-10-18T09:00:00Z");
const d = (iso: string) => new Date(iso);
const rec = (display: RecordStatus["display"], application: RecordStatus["application"] = "open"): RecordStatus =>
  ({ display, application, freshness: display === "recheck" ? "recheck" : "current", lastVerifiedAt: now });
const input = (x: Partial<BriefInput>): BriefInput => ({ record: rec("open"), closesAt: null, opensAt: null, deadlineKind: "official", hasGuide: false, ...x });

describe("time left", () => {
  it("counts whole days up to an official deadline and flags the last week", () => {
    expect(daysUntil(d("2026-10-28T16:00:00Z"), now)).toBe(11);
    expect(timeLeftOf(input({ closesAt: d("2026-10-28T16:00:00Z") }), now)).toMatchObject({ kind: "days_left", days: 11, urgent: false });
    expect(timeLeftOf(input({ closesAt: d("2026-10-22T16:00:00Z") }), now)).toMatchObject({ kind: "days_left", urgent: true });
    expect(timeLeftOf(input({ closesAt: d("2026-10-18T20:00:00Z") }), now)).toMatchObject({ kind: "last_day" });
  });
  it("never counts down for records that need re-checking, are unverified or conflicting", () => {
    for (const s of ["recheck", "unverified", "conflicting"] as const) {
      expect(timeLeftOf(input({ record: rec(s), closesAt: d("2026-11-13T16:00:00Z") }), now).kind).toBe("check_status");
      expect(nextActionOf(input({ record: rec(s), closesAt: d("2026-11-13T16:00:00Z") }), now)).toBe("confirm_status");
    }
  });
  it("rolling, upcoming, passed and missing deadlines are stated plainly", () => {
    expect(timeLeftOf(input({ record: rec("rolling", "rolling"), deadlineKind: "rolling" }), now).kind).toBe("rolling");
    expect(timeLeftOf(input({ record: rec("upcoming", "upcoming"), opensAt: d("2026-10-25T08:00:00Z") }), now)).toMatchObject({ kind: "opens_in", days: 7 });
    expect(timeLeftOf(input({ record: rec("deadline_passed", "deadline_passed") }), now).kind).toBe("passed");
    expect(timeLeftOf(input({ deadlineKind: "unknown" }), now).kind).toBe("no_deadline_recorded");
  });
  it("the next action follows the status", () => {
    expect(nextActionOf(input({ closesAt: d("2026-10-28T16:00:00Z"), hasGuide: true }), now)).toBe("read_guide_then_apply");
    expect(nextActionOf(input({ closesAt: d("2026-10-28T16:00:00Z") }), now)).toBe("apply_now");
    expect(nextActionOf(input({ record: rec("upcoming", "upcoming"), opensAt: d("2026-10-25T08:00:00Z") }), now)).toBe("prepare");
    expect(nextActionOf(input({ record: rec("closed", "closed") }), now)).toBe("see_similar");
  });
});

describe("«Νέα για εσάς» feed", () => {
  const item = (id: string, x: { opens?: string; closes?: string; status?: "open" | "upcoming" | "recheck" | "passed"; display?: RecordStatus["display"] }) => ({
    record: rec(x.display ?? "open"), status: x.status ?? "open",
    row: { id, opens_at: x.opens ? d(x.opens) : null, closes_at: x.closes ? d(x.closes) : null, deadline_kind: "official" },
  });
  it("opened = official opening date in the last 21 days; closing = next 14 days; ordered", () => {
    const items = [
      item("a", { opens: "2026-10-10T00:00:00Z", closes: "2027-01-10T00:00:00Z" }),
      item("b", { opens: "2026-08-01T00:00:00Z", closes: "2026-10-25T00:00:00Z" }),
      item("c", { opens: "2026-10-15T00:00:00Z", closes: "2026-10-20T00:00:00Z" }),
      item("d", { opens: "2026-10-12T00:00:00Z", closes: "2026-11-30T00:00:00Z", display: "recheck", status: "recheck" }),
    ];
    const f = buildFeed(items, [], now);
    expect(f.opened.map((x) => x.item.row.id)).toEqual(["c", "a"]); // d needs re-check → excluded
    expect(f.closing.map((x) => x.item.row.id)).toEqual(["c", "b"]);
  });
  it("only recorded changes count as changed; first imports and old changes do not", () => {
    const items = [item("a", { closes: "2027-01-10T00:00:00Z" }), item("b", { closes: "2027-01-10T00:00:00Z" })];
    const f = buildFeed(items, [
      { opportunity_id: "a", at: d("2026-10-16T10:00:00Z"), kind: "extension" },
      { opportunity_id: "b", at: d("2026-10-17T10:00:00Z"), kind: "created" },
      { opportunity_id: "b", at: d("2026-09-01T10:00:00Z"), kind: "amendment" },
    ], now);
    expect(f.changed.map((x) => [x.item.row.id, x.change])).toEqual([["a", "extension"]]);
  });
  it("copy exists in both languages", () => {
    for (const s of [SITE.el, SITE.en]) {
      expect(s.feed.rules).toMatch(/21/);
      expect(s.brief.daysLeft(3)).toContain("3");
      expect(s.brief.actions.confirm_status).toBeTruthy();
    }
  });
});
