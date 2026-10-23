/**
 * Guides use the canonical record status (record-status.ts): computed from the dates and the re-check interval, never
 * frozen, and identical to what the listing shows for the same record.
 */
import { describe, expect, it } from "vitest";
import { PROGRAMME_GUIDES } from "@/lib/site/guides";
import { programmeStatus, statusFromVerified, verifiedCloses } from "@/lib/site/guide-status";
import type { RecordStatus } from "@/lib/domain/record-status";
import { SITE } from "@/lib/site/copy";
import { verifiedFor } from "@/lib/site/verified";

const at = (iso: string) => new Date(iso);
const d = (key: string, iso: string) => statusFromVerified(key, at(iso)).display;
const live = (display: RecordStatus["display"], application: RecordStatus["application"]): RecordStatus =>
  ({ display, application, freshness: display === "recheck" ? "recheck" : "current", lastVerifiedAt: at("2026-10-13T21:00:00Z") });

describe("programme status on guides (from the checked file, same rules as the database)", () => {
  it("DiscoverEU: «Υπό επιβεβαίωση» since 22 Oct 2026 — the official page does not confirm the round; no dates shown as fact", () => {
    for (const t of ["2026-10-01T12:00:00Z", "2026-10-23T12:00:00Z", "2027-03-01T12:00:00Z"]) expect(d("manual:discovereu", t)).toBe("unverified");
    expect(verifiedCloses("manual:discovereu")).toBeNull();
  });

  it("A21: checked again 22 Oct 2026; open while fresh, «needs re-check» after 3 days with the last verified status kept, passed after 13 Nov", () => {
    expect(d("manual:a21", "2026-10-23T08:00:00Z")).toBe("open");
    const s = statusFromVerified("manual:a21", at("2026-10-26T12:00:00Z"));
    expect(s.display).toBe("recheck");
    expect(s.application).toBe("open");
    expect(s.lastVerifiedAt?.toISOString()).toBe("2026-10-21T21:00:00.000Z"); // 22 Oct, midnight Athens
    expect(d("manual:a21", "2026-11-13T16:00:01Z")).toBe("deadline_passed");
  });

  it("Articles 5Β and 5Α: the next deadline still open for someone, by year of move (A.1192/2026, A.1147/2026)", () => {
    expect(verifiedCloses("manual:art5b", at("2026-10-23T08:00:00Z"))!.toISOString()).toBe("2026-10-31T21:59:59.999Z");
    expect(d("manual:art5b", "2026-10-23T08:00:00Z")).toBe("open");
    // after 31 Oct 2026 the programme stays open for people who moved after 2 Jul 2026 (next: 31 Oct 2027)
    expect(verifiedCloses("manual:art5b", at("2026-11-02T08:00:00Z"))!.toISOString()).toBe("2027-10-31T21:59:59.999Z");
    expect(d("manual:art5b", "2026-11-02T08:00:00Z")).toBe("open");
    expect(verifiedCloses("manual:art5a", at("2026-10-23T08:00:00Z"))!.toISOString()).toBe("2027-09-30T20:59:59.999Z");
    expect(d("manual:art5a", "2026-10-23T08:00:00Z")).toBe("open");
    expect(d("manual:art5a", "2026-12-01T08:00:00Z")).toBe("recheck"); // checked 22 Oct, interval 30 days
  });

  it("a date-only deadline counts the whole day (Athens time)", () => {
    expect(verifiedCloses("manual:spiti2")!.toISOString()).toBe("2026-05-31T20:59:59.999Z");
  });

  it("closed records stay closed; stale data is never turned into closed", () => {
    expect(d("manual:spiti2", "2026-10-16T08:00:00Z")).toBe("closed");
    expect(d("manual:studenthousing", "2026-07-15T12:00:00Z")).toBe("closed");
    expect(d("manual:unemployment", "2027-06-01T08:00:00Z")).toBe("recheck"); // not "closed"
  });

  it("rolling programmes are rolling while fresh and «needs re-check» after 30 days", () => {
    for (const k of ["manual:art5c", "manual:unemployment"]) {
      expect(d(k, "2026-10-23T08:00:00Z")).toBe("rolling");
      expect(d(k, "2027-06-01T08:00:00Z")).toBe("recheck");
    }
  });

  it("EIC: next cut-off 4 Nov 2026, then passed", () => {
    expect(d("manual:eic", "2026-10-16T08:00:00Z")).toBe("open");
    expect(d("manual:eic", "2026-11-04T16:00:01Z")).toBe("deadline_passed");
  });

  it("unknown records are never shown as open", () => {
    expect(d("manual:does-not-exist", "2026-10-16T08:00:00Z")).toBe("unknown");
  });
});

describe("guides follow the live record exactly", () => {
  const now = at("2026-10-17T12:00:00Z");
  it("the live record's status is shown as is, including «needs re-check»", () => {
    expect(programmeStatus("manual:a21", now, live("recheck", "open")).display).toBe("recheck");
    expect(programmeStatus("manual:a21", now, live("closed", "closed")).display).toBe("closed");
    expect(programmeStatus("manual:unemployment", now, live("rolling", "rolling")).display).toBe("rolling");
  });
  it("a verified closing time that has passed wins over a live open or re-check answer", () => {
    const later = at("2026-11-14T12:00:00Z"); // Α21 closed 13 Nov 2026, 18:00
    expect(programmeStatus("manual:a21", later, live("open", "open")).display).toBe("deadline_passed");
    expect(programmeStatus("manual:a21", later, live("recheck", "open")).display).toBe("deadline_passed");
  });
  it("no guide shows an actionable status once its verified closing time has passed", () => {
    for (const g of PROGRAMME_GUIDES) {
      const closes = verifiedCloses(g.recordKey);
      // deadlines by year of move (5Α, 5Β) move on to the next one: tested above, not «passed» for everyone
      if (!closes || verifiedFor(g.recordKey)?.deadlineRule) continue;
      const after = new Date(closes.getTime() + 1000);
      for (const s of [programmeStatus(g.recordKey, after), programmeStatus(g.recordKey, after, live("open", "open"))]) {
        expect([g.slug, s.display]).not.toEqual([g.slug, "open"]);
        expect([g.slug, s.display]).not.toEqual([g.slug, "rolling"]);
      }
    }
  });
});

describe("labels", () => {
  it("every canonical status has a Greek and an English label", () => {
    for (const k of ["open", "rolling", "upcoming", "recheck", "deadline_passed", "closed", "suspended", "unverified", "conflicting", "unknown"]) {
      expect(SITE.el.record.labels[k as keyof typeof SITE.el.record.labels]).toBeTruthy();
      expect(SITE.en.record.labels[k as keyof typeof SITE.en.record.labels]).toBeTruthy();
    }
    expect(SITE.el.record.labels.recheck).toBe("Χρειάζεται νέος έλεγχος");
  });
  it("the guide model carries no stored status", () => {
    for (const g of PROGRAMME_GUIDES) expect("status" in g).toBe(false);
  });
});
