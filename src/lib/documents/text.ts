/**
 * Converts fetched official documents to plain text for extraction. Content is untrusted:
 * scripts/styles are dropped, nothing is executed, size is bounded.
 */
const MAX_CHARS = 400_000;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  // Keep page markers so extracted quotes can cite a page number.
  const joined = (text as string[]).map((t, i) => `[[page ${i + 1}]]\n${t}`).join("\n\n");
  return { text: joined.slice(0, MAX_CHARS), pages: totalPages };
}

export async function documentToText(body: Buffer, contentType: string | null): Promise<{ text: string; pages: number | null; kind: "pdf" | "html" | "text" }> {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("pdf") || body.subarray(0, 5).toString("latin1") === "%PDF-") {
    const r = await pdfToText(new Uint8Array(body));
    return { ...r, kind: "pdf" };
  }
  const raw = body.toString("utf8");
  if (ct.includes("html") || /<html|<body|<div/i.test(raw.slice(0, 2000))) return { text: htmlToText(raw), pages: null, kind: "html" };
  return { text: raw.slice(0, MAX_CHARS), pages: null, kind: "text" };
}

/** Whitespace/case-insensitive verbatim check used to verify that a quoted requirement really is in the document. */
export function containsQuote(document: string, quote: string): boolean {
  const norm = (s: string) => s.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
  const q = norm(quote);
  return q.length >= 8 && norm(document).includes(q);
}

/** Phrases typical of prompt-injection attempts inside documents. Detection only flags; it never "obeys". */
export function suspectedInjection(text: string): boolean {
  return /(ignore (all |any )?(previous|prior|above) instructions|disregard (the )?(system|previous)|you are now|system prompt|assistant:|mark (every|all) (user|applicant)s? (as )?eligible|αγνόησε (τις )?(προηγούμενες )?οδηγίες)/i.test(text);
}

/** Finds the page marker preceding a quote (PDFs only). */
export function pageOfQuote(document: string, quote: string): number | null {
  const idx = document.toLowerCase().indexOf(quote.slice(0, 40).toLowerCase());
  if (idx < 0) return null;
  const before = document.slice(0, idx);
  const m = [...before.matchAll(/\[\[page (\d+)\]\]/g)].pop();
  return m ? Number(m[1]) : null;
}
