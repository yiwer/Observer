import { createHash } from "node:crypto";
import { VerificationSchema, type CandidateV2, type Claim, type GateDecision, type SemanticVerifier, type UnconfirmedItem, type VerificationInput } from "./gate-contracts.ts";
import { editionNames, type ProduceRequest, type ReportRecord } from "./contracts.ts";
import { domainFailure } from "./domain-evidence.ts";

export const inputDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface EvaluationOptions {
  request: ProduceRequest;
  stories: CandidateV2[];
  // Batched evaluation retains the complete identity scope for structural checks.
  structuralStories?: CandidateV2[];
  verifier: SemanticVerifier | undefined;
  recordVerifierDispatch?: boolean;
  domainRules?: boolean;
  clock: () => string;
  modelPolicyCheck: (evidenceIds: string[], atUtc: string) => string | null;
  publicationPolicyCheck: (evidenceIds: string[], claim: Claim, atUtc: string) => string | null;
}

export async function evaluatePublication(options: EvaluationOptions) {
  const { request, stories, verifier } = options;
  const structuralReason = (story: CandidateV2, claim: Claim) =>
    claim.evidenceIds.some((id) => !request.evidenceBundle.evidence.some((evidence) => evidence.id === id)) ? "unknown-evidence-reference" :
    new Set(claim.evidenceIds).size !== claim.evidenceIds.length || story.claims.filter((item) => item.id === claim.id).length !== 1 ||
    (options.structuralStories ?? stories).filter((item) => item.id === story.id).length !== 1 ? "ambiguous-claim-identity" : null;
  const beforeVerifierUtc = options.clock();
  const modelFailures = new Map(request.evidenceBundle.evidence.map((item) => [item.id, options.modelPolicyCheck([item.id], beforeVerifierUtc)]));
  const permitted = new Set([...modelFailures].filter(([, reason]) => reason === null).map(([id]) => id));
  const reviewStories = stories.map((story) => ({ ...story, title: "陈述级核验", claims: story.claims.filter((claim) => !structuralReason(story, claim) && claim.evidenceIds.every((id) => permitted.has(id))) })).filter((story) => story.claims.length > 0);
  const context = { schemaVersion: 1 as const, taskId: request.taskId, evidenceBundleId: request.evidenceBundle.id, configurationId: request.configurationId, stories: reviewStories, evidence: request.evidenceBundle.evidence.filter((evidence) => permitted.has(evidence.id)) };
  const input: VerificationInput = { ...context, inputSha256: inputDigest(context) };
  let output: unknown;
  let dispatchedEvidenceIds: string[] = [];
  try {
    if (verifier && reviewStories.length) {
      const dispatched = structuredClone(input);
      dispatchedEvidenceIds = dispatched.evidence.map((evidence) => evidence.id);
      output = await verifier.verify(dispatched);
    }
  } catch { /* External error text is never retained. */ }
  const completedAtUtc = options.clock();
  const parsed = VerificationSchema.safeParse(output);
  const expected = reviewStories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claim })));
  const consistentReasons = { supported: ["supported-by-evidence"], insufficient: ["insufficient-evidence"], conflicting: ["source-conflict"], unsafe: ["unsafe-material", "irrelevant-evidence"] };
  const valid = parsed.success && parsed.data.assessments.every((item) => item.eventProjection === undefined && item.selectionProjection === undefined && item.domainProjection === undefined && consistentReasons[item.conclusion].includes(item.reason)) && parsed.data.inputSha256 === input.inputSha256 && parsed.data.assessments.length === expected.length && expected.every(({ storyId, claim }) => {
    const matches = parsed.data.assessments.filter((item) => item.storyId === storyId && item.claimId === claim.id);
    return matches.length === 1 && matches[0]!.evidence.length === claim.evidenceIds.length &&
      new Set(matches[0]!.evidence.map((item) => item.evidenceId)).size === claim.evidenceIds.length &&
      matches[0]!.evidence.every((item) => claim.evidenceIds.includes(item.evidenceId));
  });
  const verification = valid ? parsed.data : null;
  const decisions: GateDecision[] = [];
  const unconfirmedItems: UnconfirmedItem[] = [];
  const published: CandidateV2[] = [];
  for (const story of stories) {
    const claims = story.claims.filter((claim) => {
      const assessment = verification?.assessments.find((item) => item.storyId === story.id && item.claimId === claim.id);
      const decide = (outcome: GateDecision["outcome"], reason: string, checks: Partial<Pick<GateDecision, "structure" | "policy" | "semantic">> = {}) => {
        decisions.push({ storyId: story.id, claimId: claim.id, inputClaimSha256: inputDigest(claim), evidenceIds: claim.evidenceIds,
          structure: { status: "passed", reason: "valid-claim" }, policy: { status: "passed", reason: "eligible-source" },
          semantic: { status: "not-evaluated", reason }, outcome, reason, ...checks });
        if (outcome === "unconfirmed" && assessment?.wording === "original" && claim.kind !== "quotation") {
          unconfirmedItems.push({ storyId: story.id, claimId: claim.id, edition: story.edition, description: claim.text, evidenceIds: claim.evidenceIds });
        }
      };
      const structureFailure = structuralReason(story, claim);
      if (structureFailure) {
        decide("quarantined", structureFailure, {
          structure: { status: "failed", reason: structureFailure }, policy: { status: "not-evaluated", reason: "structure-failed" },
          semantic: { status: "not-evaluated", reason: "structure-failed" } });
        return false;
      }
      const policyFailure = claim.evidenceIds.map((id) => modelFailures.get(id)).find((reason) => reason != null) ?? options.publicationPolicyCheck(claim.evidenceIds, claim, completedAtUtc);
      if (policyFailure) {
        decide("quarantined", policyFailure, { policy: { status: "failed", reason: policyFailure }, semantic: { status: "not-evaluated", reason: "policy-failed" } });
        return false;
      }
      if (!verification) {
        decide("quarantined", "invalid-verifier-receipt");
        return false;
      }
      const domainRejected = options.domainRules && assessment ? domainFailure(claim, assessment, request.evidenceBundle.evidence, request.evidenceBundle.cutoffUtc) : null;
      if (domainRejected) {
        decide(domainRejected.outcome, domainRejected.reason, { semantic: { status: assessment!.conclusion, reason: assessment!.reason } });
        return false;
      }
      const semanticFailure = assessment?.conclusion === "unsafe" || assessment?.wording === "unsafe" ? "unsafe-material" :
        assessment?.evidence.some((item) => item.relation === "irrelevant") ? "irrelevant-evidence" :
        assessment?.conclusion === "conflicting" || assessment?.evidence.some((item) => item.relation === "contradicts") ? "source-conflict" :
        claim.kind !== "quotation" && assessment?.wording !== "original" ? "unmarked-quotation" :
        assessment?.conclusion === "insufficient" ? "insufficient-evidence" : null;
      if (semanticFailure) {
        const unresolved = semanticFailure === "source-conflict" || semanticFailure === "insufficient-evidence";
        decide(unresolved ? "unconfirmed" : "quarantined", semanticFailure, { semantic: { status: unresolved ? semanticFailure === "source-conflict" ? "conflicting" : "insufficient" : "unsafe", reason: semanticFailure } });
        return false;
      }
      if (claim.kind === "quotation" && (!request.evidenceBundle.evidence.find((item) => item.id === claim.evidenceIds[0])?.content?.includes(claim.originalText) || (!claim.translated && claim.text !== claim.originalText) || assessment?.wording !== "quotation")) {
        decide("quarantined", "quotation-unverified", { semantic: { status: "unsafe", reason: "quotation-unverified" } });
        return false;
      }
      const support = assessment?.evidence.filter((item) => item.relation === "supports" && item.reliability === "reliable" && item.basis !== "publisher-statement" && claim.evidenceIds.includes(item.evidenceId)) ?? [];
      const primary = support.some((item) => item.basis === "direct-observation" && request.evidenceBundle.evidence.some((evidence) => evidence.id === item.evidenceId && evidence.sourceType === "primary"));
      const knownOrigins = support.filter((item) => item.upstreamOriginId !== null);
      const origins = new Set(knownOrigins.map((item) => item.upstreamOriginId));
      const sources = new Set(knownOrigins.map((item) => request.evidenceBundle.evidence.find((evidence) => evidence.id === item.evidenceId)?.sourceId));
      const attributed = claim.kind === "statement" && assessment?.evidence.some((item) => item.relation === "supports" && item.basis === "publisher-statement" && request.evidenceBundle.evidence.some((evidence) => evidence.id === item.evidenceId && evidence.sourceId === claim.publisherSourceId));
      const hasSupport = claim.kind === "statement" ? attributed : claim.kind === "quotation" || claim.kind === "analysis" ? assessment?.evidence.some((item) => item.relation === "supports") : primary || (origins.size >= 2 && sources.size >= 2);
      const supported = assessment?.conclusion === "supported" && hasSupport;
      const reason = supported ? claim.kind === "statement" ? "attributed-statement" : claim.kind === "quotation" ? "verified-quotation" : claim.kind === "analysis" ? "editorial-analysis" : primary ? "appropriate-primary" : "independent-corroboration" :
        assessment?.evidence.some((item) => item.basis === "publisher-statement") ? "publisher-statement-not-fact" : "insufficient-independent-sources";
      decide(supported ? "published" : "unconfirmed", reason, { semantic: { status: assessment?.conclusion ?? "not-evaluated", reason: assessment?.reason ?? "verifier-unavailable" } });
      return supported;
    });
    if (claims.length) published.push({ ...story, title: claims.find((claim) => claim.kind === "fact")?.text ?? "陈述级核验", claims });
  }
  return { stories: published, completedAtUtc, publicationGate: { schemaVersion: 1 as const, checkedAtUtc: completedAtUtc, decisions, verification, unconfirmedItems, input: {
    inputSha256: input.inputSha256, taskId: request.taskId, evidenceBundleId: request.evidenceBundle.id, configurationId: request.configurationId,
    verificationEvidenceIds: context.evidence.map((evidence) => evidence.id),
    ...(options.recordVerifierDispatch ? { dispatchedEvidenceIds } : {}),
    evidence: request.evidenceBundle.evidence.map((evidence) => ({ evidenceId: evidence.id, sourceId: evidence.sourceId, sourceType: evidence.sourceType, retrievedAtUtc: evidence.retrievedAtUtc,
      ...("policyVersion" in evidence ? { policyVersion: evidence.policyVersion, policySha256: evidence.policySha256 } : {}),
    })),
  } } };
}

export function claimWording(claim: Claim): string {
  if (claim.kind === "quotation") return `引语（${claim.translated ? `译文 · ${claim.language}` : "原文"}）：${claim.text}${claim.translated ? `\n\n原文：${claim.originalText}` : ""}`;
  const label = claim.kind === "statement" ? `发布者声明（${claim.publisherSourceId}）` : claim.kind === "analysis" ? `分析（${claim.mode === "scenario" ? "情景" : "解释"}）` : "事实";
  return `${label}：${claim.text}`;
}

export const escapeMarkdown = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replace(/[\\`*_{}\[\]()#+!|~]/g, "\\$&").replace(/[\r\n]+/g, " ");
export const failureExplanations: Record<string, string> = {
  "domain-assessment-unavailable": "主题风险评估缺失或未知，无法安全呈现该陈述。",
  "domain-assertion-inconsistent": "陈述类型与事实、归因或解释判断不一致，不能借类型标签绕过证据门。",
  "high-risk-independent-sources-required": "高风险断言至少需要两个独立可靠来源；相同上游的转载不能形成交叉确认。",
  "finance-primary-corroboration-required": "高风险财经除两个独立可靠来源外，还必须包含一个适当的一手直接观察。",
  "financial-content-forbidden": "财经仅呈现资讯与影响解释；买卖指令、目标价、收益承诺或边界未知的内容已隔离。",
  "statistics-time-unavailable": "动态数字缺少本陈述证据支持的有效统计时间；未用材料发布时间代填，原数字已隔离。",
  "statistics-attribution-unavailable": "动态数字尚无自身独立交叉依据或明确单方来源归因，原数字已隔离。",
  "research-assessment-unavailable": "研究成熟度缺少本陈述逐证据判断，不能借用其他材料的研究标签。",
  "company-capability-unconfirmed": "公司能力声明尚无独立证据支持；官方发布不等于能力已经验证。",
  "publication-material-forbidden": "未核验社交视频、血腥图片或材料性质未知，不得进入报道材料。",
  "unknown-evidence-reference": "引用的 Evidence 不在本次材料中，已隔离该陈述。",
  "ambiguous-claim-identity": "陈述或证据标识重复，无法建立唯一核验关系。",
  "invalid-verifier-receipt": "语义核验未返回完整且关联正确的结果，尚不能发布。",
  "source-policy-invalid": "来源政策的批准状态、版本或来源身份与材料不符。",
  "evidence-expired": "材料在完成核验时已过保留期限，不能继续用于本次发布。",
  "model-forbidden": "来源未许可本次模型处理。",
  "distribution-forbidden": "来源未许可分发衍生正文。",
  "archive-forbidden": "来源未许可永久归档。",
  "citation-forbidden": "来源未许可引用。",
  "citation-unavailable": "缺少允许分发的引用元数据。",
  "citation-limit": "该来源的原文与译文引语总量超过许可限额。",
  "quotation-unverified": "引语原文不存在于允许研究的材料中，或译文标识与原文不一致。",
  "unsafe-material": "语义核验标记了恶意或不安全材料，相关文字已隔离。",
  "irrelevant-evidence": "所列材料含不支持本陈述的无关证据。",
  "source-conflict": "来源对本陈述存在冲突，冲突关系保留在核验记录中；当前无法确认。",
  "unmarked-quotation": "文本被识别为引文，但未按引语契约核查与标识。",
  "insufficient-evidence": "现有证据不足以确认该陈述。",
  "publisher-statement-not-fact": "发布者的单方声明仅证明其说法，尚不能确认说法中的事实。",
  "insufficient-independent-sources": "缺少适当一手观察或两个独立可靠来源；同一上游转载只计一个来源。",
};

export function gatedMarkdown(record: Extract<ReportRecord, { schemaVersion: 2 }>): string {
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    "> 自动化标注替身产物；语义判定流程已执行，未经过真实研究或生产准入。",
    "## Today Overview",
    ...Object.entries(editionNames).map(([edition, label]) => `- ${label}：${escapeMarkdown(record.stories.find((story) => story.edition === edition)?.title ?? "Coverage Gap")}`),
    ...record.stories.flatMap((story) => [
      `## ${editionNames[story.edition]}`, `### ${escapeMarkdown(story.title)}`,
      ...story.claims.map((claim) => `${escapeMarkdown(claimWording(claim))}\n\n${claim.evidenceIds.map((id) => {
        const evidence = record.evidenceBundle.evidence.find((item) => item.id === id)!;
        const policy = record.sourcePolicyDecisions.find((item) => item.evidenceId === id);
        const url = evidence.url!.replace(/[<>\s]/g, (character) => encodeURIComponent(character));
        return `来源：${policy?.decision === "source-policy-v1" ? escapeMarkdown(policy.attribution) + " — " : ""}[直达原始材料](<${url}>) [${escapeMarkdown(id)}]`;
      }).join("\n\n")}`),
    ]),
    ...record.publicationGate.unconfirmedItems.flatMap((item) => [
      `## ${editionNames[item.edition]} · 待确认`,
      `待确认说法（非已证事实）：${escapeMarkdown(item.description)}`,
      ...item.evidenceIds.map((id) => {
        const evidence = record.evidenceBundle.evidence.find((entry) => entry.id === id)!;
        const attribution = record.sourcePolicyDecisions.find((entry) => entry.evidenceId === id);
        const assessment = record.publicationGate.verification?.assessments.find((entry) => entry.storyId === item.storyId && entry.claimId === item.claimId);
        const relation = assessment?.evidence.find((entry) => entry.evidenceId === id)?.relation;
        const label = relation === "contradicts" ? "提供相反材料" : relation === "supports" ? "提供支持材料" : "关系未确认";
        return `来源 ${escapeMarkdown(evidence.sourceId)}（${label}）：${attribution?.decision === "source-policy-v1" ? escapeMarkdown(attribution.attribution) + " — " : ""}[原始材料](<${evidence.url!.replace(/[<>\s]/g, (character) => encodeURIComponent(character))}>)`;
      }),
    ]),
    ...record.publicationGate.decisions.filter((decision) => decision.outcome !== "published").map((decision) => `${decision.outcome === "unconfirmed" ? "Unconfirmed Item（待确认）" : "Coverage Gap（隔离项）"} [${escapeMarkdown(decision.storyId)}/${escapeMarkdown(decision.claimId)}]：${failureExplanations[decision.reason] ?? "该陈述未通过发布门。"} (${decision.reason})`),
  ].join("\n\n") + "\n";
}
