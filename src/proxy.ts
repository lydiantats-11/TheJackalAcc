import { NextResponse, type NextRequest } from "next/server";

/**
 * Private-site gate (15 Oct 2026): when SITE_PASSWORD is set, every page asks for a password (HTTP Basic auth; any
 * user name) and tells search engines not to index. Unset locally and in tests, so nothing changes there.
 * This keeps the private live preview private; it is not a substitute for the app's own accounts.
 */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let supplied = "";
    try { supplied = atob(header.slice(6)).split(":").slice(1).join(":"); } catch { supplied = ""; }
    if (sameText(supplied, password)) {
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }
  return new NextResponse("Private preview — password required / Ιδιωτική προεπισκόπηση — απαιτείται κωδικός", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Jackal Accountant preview", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Comparison whose time does not depend on where the first difference is. */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
