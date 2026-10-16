/** Workstream F: the daily report never claims a check that did not run on the reported commit. */
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs helper without type declarations
import { overallStatus, parseBuild, parseTypecheck, parseVitest, readSections, renderReport, resultsCommit } from "../scripts/report-lib.mjs";

describe("daily report helpers", () => {
  it("reads vitest totals, with or without failures and colour codes", () => {
    expect(parseVitest("\u001b[2m      Tests \u001b[22m \u001b[1m\u001b[32m248 passed\u001b[39m\u001b[22m\u001b[90m (248)\u001b[39m")).toEqual({ passed: 248, failed: 0, total: 248 });
    expect(parseVitest("      Tests  3 failed | 232 passed (235)")).toEqual({ passed: 232, failed: 3, total: 235 });
    expect(parseVitest("")).toBeNull();
  });
  it("type check and build: counted only when they ran", () => {
    expect(parseTypecheck("> tsc --noEmit\n")).toBe(0);
    expect(parseTypecheck("> tsc --noEmit\nsrc/a.ts(1,1): error TS2322: x\nsrc/b.ts(2,2): error TS2345: y")).toBe(2);
    expect(parseTypecheck("")).toBeNull();
    expect(parseBuild("✓ Compiled successfully in 6.1s")).toBe("ok");
    expect(parseBuild("Failed to compile")).toBe("failed");
    expect(parseBuild("")).toBeNull();
  });
  it("finds the commit a CI snapshot belongs to", () => {
    expect(resultsCommit("Design preview, run 30 (a724be8)")).toBe("a724be8");
    expect(resultsCommit("something else")).toBeNull();
  });
  it("status: failed check → Blocked; unmeasured → Attention; waiting decisions → Attention; else On track", () => {
    const ok = { passed: 5, failed: 0, total: 5 };
    expect(overallStatus({ tests: { passed: 4, failed: 1, total: 5 }, typecheck: 0, build: "ok", measuredOnHead: true, decisions: 0 }).status).toBe("Blocked");
    expect(overallStatus({ tests: null, typecheck: null, build: null, measuredOnHead: false, decisions: 0 }).status).toBe("Attention needed");
    expect(overallStatus({ tests: ok, typecheck: 0, build: "ok", measuredOnHead: true, decisions: 2 }).status).toBe("Attention needed");
    expect(overallStatus({ tests: ok, typecheck: 0, build: "ok", measuredOnHead: true, decisions: 0 }).status).toBe("On track");
  });
  it("renders 'not measured' instead of guessing, and the required sections", () => {
    const r = renderReport({ date: "2026-10-16", branch: "consolidation", head: "abc1234", since: null, completed: [], areas: [], measuredOnHead: false,
      resultsCommit: null, tests: null, typecheck: null, build: null, quality: null, blockers: [], decisions: [], next: [],
      overall: { status: "Attention needed", why: "checks were not measured on the latest commit" } });
    for (const h of ["**Completed today**", "**Quality checks**", "**Problems or blockers**", "**Decisions needed**", "**Next recommended actions**", "**Overall status**"]) expect(r).toContain(h);
    expect(r).toContain("Tests: not measured");
    expect(r).not.toMatch(/passed/);
  });
  it("reads the open-decisions file", () => {
    const s = readSections("# T\n\n## Decisions needed\n\n- A\n- B\n\n## Blockers\n\n- C\n\n## Next\n\n1. D\n");
    expect(s["decisions needed"]).toEqual(["A", "B"]);
    expect(s.blockers).toEqual(["C"]);
    expect(s.next).toEqual(["D"]);
  });
});
