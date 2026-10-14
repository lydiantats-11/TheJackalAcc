/**
 * SYNTHETIC fixtures shaped like the EU Funding & Tenders search response as described by independent clients
 * (metadata values are single-element arrays). Identifiers and titles are FICTIONAL ("TEST-…"). They are NOT
 * captured from the live service, which this workspace cannot reach.
 */
export function topic(id: string, o: { status?: string; deadline?: string | string[]; title?: string; url?: string | null; updated?: string } = {}) {
  const deadlines = o.deadline === undefined ? ["2026-12-03T17:00:00.000+0100"] : Array.isArray(o.deadline) ? o.deadline : [o.deadline];
  return {
    url: o.url === null ? undefined : o.url ?? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${id.toLowerCase()}`,
    metadata: {
      identifier: [id],
      title: [o.title ?? `[TEST DATA] Fictional topic ${id}`],
      status: [o.status ?? "31094502"],
      deadlineDate: deadlines,
      startDate: ["2026-09-01T00:00:00.000+0200"],
      frameworkProgramme: ["43108390"],
      ...(o.updated ? { updateDate: [o.updated] } : {}),
    },
  };
}

export function page(results: unknown[], totalResults?: number) {
  return JSON.stringify({ results, ...(totalResults !== undefined ? { totalResults } : {}) });
}

/** A fake `fetch` that serves pages by pageNumber and records the calls it received. */
export function fakeFetch(pages: (string | number)[]) {
  const calls: { url: string; method: string; parts: string[] }[] = [];
  const impl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const n = Number(url.searchParams.get("pageNumber") ?? 1);
    const parts = init?.body instanceof FormData ? [...init.body.keys()] : [];
    calls.push({ url: url.toString(), method: init?.method ?? "GET", parts });
    const p = pages[n - 1] ?? pages[pages.length - 1]!;
    if (typeof p === "number") return new Response("error", { status: p });
    return new Response(p, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}
