import { describe, expect, it } from "vitest";
import { assess } from "@/lib/domain/eligibility";
import { rankQuestions } from "@/lib/domain/question-impact";
import { NOW, opp, rec } from "./helpers";

describe("ask only what matters (core capability 4)", () => {
  it("ranks unanswered questions by how many opportunities they would help decide", () => {
    const geo = () => rec("geography", { regions: ["GR"] });
    const a = [opp([geo()], { id: "a" }), opp([geo()], { id: "b" }), opp([rec("education", { min_level: "bachelor" })], { id: "c" })]
      .map((o) => assess(o, {}, { now: NOW }));
    const ranked = rankQuestions(a);
    expect(ranked[0]!.unlocks).toBe(2);
    expect(ranked.map((r) => r.unlocks)).toEqual([...ranked.map((r) => r.unlocks)].sort((x, y) => y - x));
  });

  it("does not ask for data that cannot change a result already decided by a failed condition", () => {
    const failed = assess(opp([rec("geography", { regions: ["GR"] }), rec("education", { min_level: "bachelor" })]), { application_country: "DE" }, { now: NOW });
    expect(failed.eligibility === "ineligible_verified" || failed.eligibility === "unlikely_eligible").toBe(true);
    expect(rankQuestions([failed])).toEqual([]);
  });
});
