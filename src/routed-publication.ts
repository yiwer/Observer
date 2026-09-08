import { ReportRecordSchema, type ReportRecord } from "./contracts.ts";
import { consistentGitHubRepromotion, githubRepromotionMarkdown } from "./github-repromotion.ts";
import { inputDigest } from "./publication-gate.ts";
import type { RoutingReceipt } from "./routing-contracts.ts";
import { recoveryMarkdown } from "./brief-recovery.ts";

type RoutedRecord = Extract<ReportRecord, { schemaVersion: 11 }>;
export function priorRoutedRecord(record: RoutedRecord): Extract<ReportRecord, { schemaVersion: 10 }> {
  const { routing: _routing, finalEditor: _editor, publicationMode: _mode, recovery: _recovery, ...base } = record;
  return { ...base, schemaVersion: 10, editorialContract: "observer-canonical-v8" };
}
// Pure Final Editor: accepted records only, no model, transport, shell or network capabilities.
// Source and history authority remain the responsibility of Observer's publication/read transaction.
export function finalizeRoutedRecord(input: Extract<ReportRecord, { schemaVersion: 10 }>, routing: RoutingReceipt, publicationMode?: "scheduled"): RoutedRecord {
  const record = ReportRecordSchema.parse(input);
  if (record.schemaVersion !== 10 || !consistentGitHubRepromotion(record)) throw new Error("final-editor-invalid-input");
  return { ...record, schemaVersion: 11, editorialContract: "observer-canonical-v9", routing, ...(publicationMode ? { publicationMode } : {}),
    finalEditor: { contract: "observer-final-editor-v1", inputRecordSha256: inputDigest(record), capabilities: { network: false, shell: false }, status: "completed" } };
}
export function consistentRoutedRecord(record: RoutedRecord): boolean {
  const prior = priorRoutedRecord(record);
  return record.routing.status === "ready" && record.routing.reportVersionId === null && record.routing.taskId === record.taskId && record.routing.evidenceBundleId === record.evidenceBundle.id && record.routing.configurationId === record.configurationId &&
    record.routing.configurationSha256 === inputDigest(record.routing.configuration) && record.finalEditor.inputRecordSha256 === inputDigest(prior) && consistentGitHubRepromotion(prior);
}
export function routedMarkdown(record: RoutedRecord): string {
  if (!consistentRoutedRecord(record)) throw new Error("canonical-routing-record-invalid");
  const scope = record.routing.reviews.some((entry) => entry.outcome === "review-unavailable") ? "single-provider；review-unavailable：第二 Provider 未参与所需复核，仍按原严格证据门判断；未声称双 Provider 对照通过。" :
    record.routing.reviews.length ? "已执行条件复核；Provider 一致不等于独立来源佐证，分歧仍受发布门约束。" : "single-provider：本轮没有条件复核；未执行完整双份研究或双 Provider 质量对照。";
  return recoveryMarkdown(record, githubRepromotionMarkdown(priorRoutedRecord(record)).replace("正文契约：observer-canonical-v8", "正文契约：observer-canonical-v9")
    .replace("> 自动化标注替身产物；未经过真实研究或生产准入。", record.publicationMode === "scheduled" ? "> 定时生成；各栏覆盖范围与处理缺口见 Today Overview。" : "> 自动化标注替身产物；未经过真实研究或生产准入。")
    .replace("## Today Overview", `Provider 范围：${scope}\n\n## Today Overview`));
}
