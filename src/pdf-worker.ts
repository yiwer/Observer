import { parentPort, workerData } from "node:worker_threads";
import { readFileSync } from "node:fs";
import type { Readable } from "node:stream";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { create, type Font } from "fontkit";
import type { ReportVersion } from "./contracts.ts";

const pdfEngine = "observer-pdf-v1/pdfkit-0.17.2/commonmark/noto-sc-2.004";
export type PdfInput = { canonicalMarkdown: string; version: ReportVersion };
export type PdfOutput = { bytes: Uint8Array; pages: number; glyphFallbacks: number };

/** No HTML renderer, evaluation, image loader, browser, shell, or resource fetch.
 * Only this fixed bundled font path is read; report strings never become paths. */
async function render({ canonicalMarkdown, version }: PdfInput): Promise<PdfOutput> {
  if (Buffer.byteLength(canonicalMarkdown, "utf8") > 8 * 1024 * 1024) throw new Error("pdf-input-limit");
  const fontBytes = readFileSync(new URL("../assets/fonts/NotoSansSC-Regular.otf", import.meta.url));
  const font = create(fontBytes) as Font;
  let glyphFallbacks = 0;
  const glyphs = new Map<number, boolean>();
  const text = (input: string, count = true) => Array.from(input.replaceAll("\t", "    ")).map((character) => {
    const code = character.codePointAt(0)!;
    if (character === "\n" || character === "\r") return character;
    if (!glyphs.has(code)) glyphs.set(code, font.hasGlyphForCodePoint(code));
    if (glyphs.get(code)) return character;
    if (count) glyphFallbacks++;
    return `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;
  }).join("");
  const doc = new PDFDocument({ size: "A4", margins: { top: 66, bottom: 62, left: 52, right: 52 },
    bufferPages: true, compress: true,
    info: { Title: `Observer Daily Brief - ${version.businessDate} - v${version.version}`, Author: "Observer",
      Subject: `Full Canonical Brief; ${version.id}; ${version.revisionReason}`,
      Keywords: `CanonicalMarkdownSHA256=${version.canonicalMarkdownSha256}; ${pdfEngine}` } });
  doc.registerFont("ObserverChinese", fontBytes).font("ObserverChinese");
  // PDFKit is a Readable; its declaration exposes only the older ReadableStream.
  const stream = doc as unknown as Readable;
  const chunks: Buffer[] = []; let bytes = 0;
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) stream.destroy(new Error("pdf-output-limit")); else chunks.push(chunk); });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Observe stream errors even if synchronous layout fails first.
  void output.catch(() => {});
  let pages = 1;
  doc.on("pageAdded", () => { if (++pages > 500) throw new Error("pdf-page-limit"); });
  const parser = new MarkdownIt("commonmark", { html: false, breaks: false, linkify: false, typographer: false });
  const anchors = new Set(Array.from(canonicalMarkdown.matchAll(/^<a id="([A-Za-z0-9][A-Za-z0-9:_-]{0,199})"><\/a>\r?$/gm), (match) => match[1]!));
  // Canonical's known navigation anchors have no visible editorial text.
  const tokens = parser.parse(canonicalMarkdown, {});
  type Run = { value: string; link?: string; goTo?: string; code?: boolean };
  function safeLink(value: string): string | undefined {
    try { const url = new URL(value); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href; }
    catch { /* Relative and other schemes remain visible text only. */ }
    return undefined;
  }
  function inline(children: Token[]): Run[] {
    const runs: Run[] = [], links: string[] = [];
    for (const token of children) {
      const href = links.at(-1), link = href ? safeLink(href) : undefined;
      const goTo = href?.startsWith("#") && anchors.has(href.slice(1)) ? href.slice(1) : undefined;
      if (token.type === "link_open") links.push(token.attrGet("href") ?? "");
      else if (token.type === "link_close") {
        const target = links.pop();
        if (target && !target.startsWith("#")) runs.push({ value: ` (${target})`, ...(safeLink(target) ? { link: safeLink(target)! } : {}) });
      } else if (token.type === "image") {
        runs.push({ value: `[图片未载入：${token.content || "无替代文字"}；地址：${token.attrGet("src") ?? "未提供"}]` });
      } else if (token.type === "softbreak" || token.type === "hardbreak") runs.push({ value: "\n" });
      else if (token.content) runs.push({ value: token.content, ...(link ? { link } : {}), ...(goTo ? { goTo } : {}), ...(token.type === "code_inline" ? { code: true } : {}) });
    }
    return runs;
  }
  const lists: Array<{ ordered: boolean; next: number }> = [];
  let prefix = "", quoteDepth = 0, heading = 0, pendingAnchor: string | undefined;
  function paragraph(runs: Run[], size = 10.5) {
    if (!runs.length) return;
    const indent = Math.min(lists.length, 16) * 14 + Math.min(quoteDepth, 8) * 12;
    const x = 52 + indent, width = doc.page.width - 52 - x;
    const value = runs.map((run) => run.value).join("");
    const anchor = /^<a id="([A-Za-z0-9][A-Za-z0-9:_-]{0,199})"><\/a>$/.exec(value.trim());
    if (anchor && anchors.has(anchor[1]!)) { pendingAnchor = anchor[1]!; return; }
    doc.fontSize(size);
    const reserve = heading ? Math.min(doc.heightOfString(text(value, false), { width, lineGap: 4 }) + 30, 180) : size * 2;
    if (doc.y + reserve > doc.page.height - 62) doc.addPage();
    if (pendingAnchor) { doc.addNamedDestination(pendingAnchor); pendingAnchor = undefined; }
    if (prefix) { runs = [{ value: prefix }, ...runs]; prefix = ""; }
    runs.forEach((run, index) => {
      doc.fontSize(run.code ? Math.min(size, 9.5) : size).fillColor(run.link || run.goTo ? "#245C83" : heading ? "#163143" : quoteDepth ? "#4E5660" : "#202932");
      const settings = { width, lineGap: 4, continued: index < runs.length - 1,
        link: run.link ?? null, goTo: run.goTo, underline: Boolean(run.link || run.goTo) };
      if (index === 0) doc.text(text(run.value), x, doc.y, settings); else doc.text(text(run.value), settings);
    });
    doc.x = 52; doc.moveDown(heading ? 0.65 : 0.45);
  }
  try {
    paragraph([{ value: `整刊 PDF · ${version.id} · 修订：${version.revisionReason}${version.previousVersionId ? ` · 前版：${version.previousVersionId}` : ""}` }], 9);
    paragraph([{ value: "由已归档 Canonical Markdown 转换；图片不加载，原始 HTML 以文字显示。" }], 8.5);
    for (const token of tokens) {
      if (token.type === "heading_open") heading = Number(token.tag.slice(1));
      else if (token.type === "heading_close") heading = 0;
      else if (token.type === "blockquote_open") quoteDepth++;
      else if (token.type === "blockquote_close") quoteDepth--;
      else if (token.type === "bullet_list_open" || token.type === "ordered_list_open") lists.push({ ordered: token.type === "ordered_list_open", next: Number(token.attrGet("start") ?? 1) });
      else if (token.type === "bullet_list_close" || token.type === "ordered_list_close") lists.pop();
      else if (token.type === "list_item_open") { const list = lists.at(-1)!; prefix = list.ordered ? `${list.next++}. ` : "• "; }
      else if (token.type === "list_item_close") prefix = "";
      else if (token.type === "inline") paragraph(inline(token.children ?? []), heading ? [22, 16, 12.5, 11.5, 11, 10.5][heading - 1]! : 10.5);
      else if (["fence", "code_block", "html_block"].includes(token.type)) paragraph([{ value: token.content }], 9);
      else if (token.type === "hr") { if (doc.y + 20 > doc.page.height - 62) doc.addPage(); doc.moveTo(52, doc.y + 4).lineTo(doc.page.width - 52, doc.y + 4).strokeColor("#CBD4DA").stroke(); doc.moveDown(); }
      else if (token.content) paragraph([{ value: token.content }]);
    }
    if (glyphFallbacks) paragraph([{ value: "字体说明：无法显示的字符已逐字标记为 [U+码位]，未省略；原文见内嵌 Markdown。" }], 8.5);
    // Exact source is also recoverable without relying on PDF text extraction.
    doc.file(Buffer.from(canonicalMarkdown, "utf8"), { name: `${version.id}.md`, type: "text/markdown", description: "Exact archived Canonical Markdown" });
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor("#6A7580").text(`OBSERVER  /  ${version.businessDate}  /  v${version.version}`, 52, 31, { lineBreak: false });
      doc.text(`${page + 1} / ${range.count}`, 52, doc.page.height - 35, { width: doc.page.width - 104, align: "right", lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
    return { bytes: await output, pages: range.count, glyphFallbacks };
  } catch (error) { stream.destroy(); throw error; }
}

if (parentPort) {
  try { parentPort.postMessage({ ok: true, ...await render(workerData as PdfInput) }); }
  catch (error) {
    const reason = error instanceof Error && /^pdf-(input|output|page)-limit$/.test(error.message) ? error.message : "pdf-conversion-failed";
    parentPort.postMessage({ ok: false, reason });
  }
}
