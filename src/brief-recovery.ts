import { editionNames, type ReportRecord, type PublishedReport } from "./contracts.ts";
import { policyDigest, type SourcePolicy } from "./collection.ts";
import { escapeMarkdown } from "./publication-gate.ts";

type Record = Extract<ReportRecord, { schemaVersion: 11 }>;
type Recovery = NonNullable<Record["recovery"]>;
export function recoveryDeadline(businessDate: string) { return new Date(`${businessDate}T12:00:00+08:00`).toISOString(); }
// Correction / withdrawal callers use this same boundary without inheriting the noon cutoff.
export function revisionWindowOpen(reason: "initial" | "completion" | "correction" | "withdrawal", businessDate: string, atUtc: string) {
  return reason === "correction" || reason === "withdrawal" || atUtc < recoveryDeadline(businessDate);
}
export function permittedLinks(bundle: import("./contracts.ts").CollectedBundle, policies: SourcePolicy[], now: string): Recovery["links"] {
  return bundle.evidence.flatMap((evidence) => {
    const source = policies.find((entry) => entry.sourceId === evidence.sourceId);
    if (!source || source.review.status !== "approved" || !source.collection.enabled || source.version !== evidence.policyVersion || policyDigest(source) !== evidence.policySha256 ||
      evidence.expiresAtUtc <= now || source.edition === "social-discourse" || source.edition === "github-projects" ||
      !source.distribution.enabled || !source.distribution.allowPermanentArchive || !source.citation.enabled || !evidence.title?.trim() || !evidence.url ||
      !["title", "url"].every((field) => source.collection.fields.includes(field as "title") && source.storage.fields.includes(field as "title") && source.distribution.fields.includes(field as "title"))) return [];
    const timeAllowed = source.collection.fields.includes("publishedAtUtc") && source.storage.fields.includes("publishedAtUtc") && source.distribution.fields.includes("publishedAtUtc");
    return [{ evidenceId: evidence.id, edition: source.edition, sourceId: evidence.sourceId, policyVersion: source.version, policySha256: evidence.policySha256,
      attribution: source.citation.attribution, title: evidence.title, url: evidence.url, publishedAtUtc: timeAllowed ? evidence.publishedAtUtc ?? null : null }];
  });
}
export function editionContent(record: Record, edition: keyof typeof editionNames) {
  if (edition === "github-projects") return record.githubRepromotion.selectedNodeIds.length;
  if (edition === "social-discourse") return record.discourse.observations.length;
  return record.editions.find((entry) => entry.edition === edition)?.storyIds.length ?? 0;
}
export function recoveryEditions(previous: PublishedReport) {
  if (previous.record.schemaVersion !== 11) return [];
  const record = previous.record;
  // Only missing research is retried. Completed research and its accepted wording are inherited.
  return (Object.keys(editionNames) as Array<keyof typeof editionNames>).filter((edition) => record.recovery ? !record.recovery.availableEditions.includes(edition) : !editionContent(record, edition));
}
function section(markdown: string, edition: keyof typeof editionNames) {
  const marker = `<a id="edition-${edition}"></a>`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const end = markdown.indexOf('<a id="edition-', start + marker.length);
  return markdown.slice(start, end < 0 ? undefined : end).trim();
}
export function recoveryMarkdown(record: Record, base: string) {
  const recovery = record.recovery;
  if (!recovery) return base;
  const label = recovery.content === "complete" ? "内容完整" : recovery.content === "links-only" ? "Degraded Brief · 仅来源链接，Agent 不可用，未生成摘要或分析" : "Degraded Brief · 内容降级";
  const delivery = recovery.timing === "pending" ? "本版生成时首次私有可读交付尚待确认" : `已确认首发交付：${recovery.timing === "delayed" ? "Delayed Brief" : "on-time"}`;
  const deliveryReference = `[交付状态与首次可读时间](/v1/briefs/${record.businessDate})`;
  if (recovery.revisionReason === "initial") {
    // Keep the previous contract's rendering stable for immutable archives.
    const publication = recovery.contract === "observer-recovery-v1" ? `${label}。${recovery.timing === "delayed" ? "Delayed Brief" : "按时生成"}；实际发布时间 ${recovery.publishedAtUtc}。${recovery.delayReason ? `迟到原因：${escapeMarkdown(recovery.delayReason)}。` : ""}` :
      `${label}；实际生成时间 ${recovery.publishedAtUtc}。${recovery.publishedAtUtc > recovery.deadlineUtc ? "Delayed Brief：生成已晚于08:30期限。" : ""}${delivery}；${deliveryReference}。`;
    base = base.replace("## Today Overview", `${publication}\n\n## Today Overview`);
    for (const edition of Object.keys(editionNames) as Array<keyof typeof editionNames>) {
      const links = recovery.links.filter((entry) => entry.edition === edition);
      if (links.length) base = base.replace(`## ${editionNames[edition]}\n`, `## ${editionNames[edition]}\n\n### 来源链接（未经 Agent 摘要或事实核验）\n\n${links.map((link) => `- [${escapeMarkdown(link.title)}](<${link.url.replace(/[<>\s]/g, encodeURIComponent)}>) — ${escapeMarkdown(link.attribution)}；来源发布时间：${link.publishedAtUtc ?? "未知或政策未允许展示"}`).join("\n")}\n`);
    }
    return base;
  }
  const inherited = recovery.inheritedMarkdown!;
  base = base.replaceAll('id="story-', `id="v${recovery.version}-story-`).replaceAll('](#story-', `](#v${recovery.version}-story-`);
  return [`# Observer Daily Brief — ${record.businessDate}`, `版本：${record.businessDate}-v${recovery.version} · Completion Revision`,
    recovery.contract === "observer-recovery-v1" ? `${label}；实际发布时间 ${recovery.publishedAtUtc}。首发时效：${recovery.timing === "delayed" ? "Delayed Brief" : "on-time"}。` :
      `${label}；实际生成时间 ${recovery.publishedAtUtc}。${delivery}；${deliveryReference}。`,
    `[前版本 ${recovery.previousVersionId}](/v1/reports/${recovery.previousVersionId}/markdown) 保持不可变。本版完整包含前版本有效内容，补齐栏目：${recovery.completedEditions.map((edition) => editionNames[edition]).join("、")}；仅使用原冻结材料。`,
    "## Today Overview",
    ...Object.entries(editionNames).map(([edition, name]) => `- [${name}](#edition-${edition})：${recovery.completedEditions.includes(edition as keyof typeof editionNames) ? "本次补齐" : "保留前版本内容"}${recovery.coverageGaps.filter((gap) => gap.edition === edition).map((gap) => `；Coverage Gap（${escapeMarkdown(gap.reason)}）`).join("")}`),
    ...(Object.keys(editionNames) as Array<keyof typeof editionNames>).map((edition) => recovery.completedEditions.includes(edition) ? section(base, edition) : section(inherited, edition)),
  ].join("\n\n") + "\n";
}
