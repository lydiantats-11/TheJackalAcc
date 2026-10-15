import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const req = (auth?: string) => new NextRequest("http://localhost/opportunities", { headers: auth ? { authorization: auth } : {} });
const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

describe("private-site password gate", () => {
  afterEach(() => { delete process.env.SITE_PASSWORD; });

  it("does nothing when SITE_PASSWORD is not set", () => {
    const res = proxy(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("asks for the password, rejects a wrong one, and lets the right one through without indexing", () => {
    process.env.SITE_PASSWORD = "olive tree 42";
    expect(proxy(req()).status).toBe(401);
    expect(proxy(req()).headers.get("WWW-Authenticate")).toContain("Basic");
    expect(proxy(req(basic("anyone", "wrong"))).status).toBe(401);
    expect(proxy(req("Basic %%%not-base64")).status).toBe(401);
    const ok = proxy(req(basic("lydia", "olive tree 42")));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(proxy(req(basic("x", "pass:with:colons")))).toBeTruthy();
  });
});
