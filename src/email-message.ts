import { createTransport } from "nodemailer";
import MarkdownIt from "markdown-it";
import type { PublishedReport } from "./contracts.ts";
import { emailBudgets, type NotificationKind } from "./email-contracts.ts";

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const markdown = new MarkdownIt("commonmark", { html: false, linkify: false, typographer: false });
// Keep labels and source text; no external resources and no dead in-mail anchor links.
// The fixed download action below is the only clickable URL in this template.
markdown.renderer.rules.link_open = () => "<span>";
markdown.renderer.rules.link_close = () => "</span>";
markdown.renderer.rules.image = (tokens, index) => escape(tokens[index]!.content);

export function todayOverview(canonicalMarkdown: string): string {
  const lines = canonicalMarkdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line === "## Today Overview");
  if (start < 0) throw new Error("email-overview-unavailable");
  let end = start + 1;
  while (end < lines.length && !/^##\s|^<a id="edition-/.test(lines[end]!)) end++;
  const result = lines.slice(start + 1, end).join("\n").trim();
  if (!result) throw new Error("email-overview-unavailable");
  return result;
}

export async function prepareEmail(input: {
  report: Pick<PublishedReport, "version" | "canonicalMarkdown">; kind: NotificationKind; address: string;
  messageId: string; atUtc: string; download: { url: string; format: "markdown" | "pdf"; expiresAtUtc: string };
  archiveUrl: string; pdf: Buffer | null; pdfReason: string;
}) {
  const { report, download } = input, overview = todayOverview(report.canonicalMarkdown);
  const link = new URL(download.url), archive = new URL(input.archiveUrl);
  if (link.protocol !== "https:" || archive.protocol !== "https:" || link.origin !== archive.origin ||
    link.username || link.password || archive.username || archive.password ||
    link.pathname !== `/v1/downloads/${report.version.id}/${download.format}`) throw new Error("email-invalid-download-url");
  const subject = `Observer ${report.version.id}${input.kind === "significant-correction" ? " · 重大更正" : " · 每日总览"}`;
  const label = download.format === "pdf" ? "下载本版本完整 PDF" : "下载本版本完整 Markdown";
  const build = async (pdf: Buffer | null, reason: string) => {
    const note = pdf ? "已附同版本完整 PDF。" : `未附 PDF（${reason}）；完整内容请通过私有下载链接读取。`;
    const expiry = `链接到期时间：${download.expiresAtUtc}（UTC），有效 24 小时，可提前撤销。`;
    const fallback = `过期后可由已授权客户端重新申请链接；以下精确版本归档地址要求 Bearer 鉴权，普通浏览器没有登录入口：${input.archiveUrl}`;
    const text = `${subject}\n版本：${report.version.id} · ${report.version.revisionReason}\n\nToday Overview\n${overview}\n\n${note}\n${label}：${download.url}\n${expiry}\n${fallback}\n`;
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head><body style="margin:0;background:#f5f5f2;color:#202020;font-family:Arial,sans-serif;line-height:1.7"><main style="max-width:680px;margin:auto;padding:24px"><h1>${escape(subject)}</h1><p>版本：${escape(report.version.id)} · ${escape(report.version.revisionReason)}</p><h2>Today Overview</h2>${markdown.render(overview)}<hr><p>${escape(note)}</p><p><a href="${escape(download.url)}" rel="noreferrer">${label}</a></p><p>${escape(expiry)}</p><p>${escape(fallback)}</p></main></body></html>`;
    const composer = createTransport({ streamTransport: true, buffer: true, newline: "windows", disableFileAccess: true, disableUrlAccess: true });
    const result = await composer.sendMail({ from: { name: "Observer", address: input.address }, to: input.address,
      subject, text, html, date: new Date(input.atUtc), messageId: input.messageId,
      disableFileAccess: true, disableUrlAccess: true,
      attachments: pdf ? [{ filename: `${report.version.id}.pdf`, content: pdf, contentType: "application/pdf", contentDisposition: "attachment" }] : [],
    });
    if (!Buffer.isBuffer(result.message)) throw new Error("email-mime-unavailable");
    return { raw: result.message, attachedPdf: pdf !== null, pdfReason: pdf ? null : reason };
  };
  let result = await build(input.pdf && input.pdf.length <= emailBudgets.pdfBytes ? input.pdf : null,
    input.pdf && input.pdf.length > emailBudgets.pdfBytes ? "pdf-over-raw-budget" : input.pdfReason);
  if (result.raw.length > emailBudgets.mimeBytes && result.attachedPdf) result = await build(null, "message-over-mime-budget");
  if (result.raw.length > emailBudgets.mimeBytes) throw new Error("email-over-mime-budget");
  // This exact encoded Buffer is sent; it is never composed again by the adapter.
  return result;
}
