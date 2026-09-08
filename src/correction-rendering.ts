import { editionNames, type ReportRecord } from "./contracts.ts";
import { claimWording, escapeMarkdown } from "./publication-gate.ts";

type Correction = Extract<ReportRecord, { schemaVersion: 12 }>;
export function correctionMarkdown(record: Correction) {
  const revision = record.revision, withdrawn = revision.revisionReason === "withdrawal";
  const citation = (id: string) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === id)!;
    const policy = record.sourcePolicyDecisions.find((item) => item.evidenceId === id);
    return `来源：${policy?.decision === "source-policy-v1" ? escapeMarkdown(policy.attribution) : escapeMarkdown(evidence.sourceId)} — [更正材料](<${evidence.url!.replace(/[<>\s]/g, encodeURIComponent)}>)；获取 ${evidence.retrievedAtUtc} [${escapeMarkdown(id)}]`;
  };
  const storyText = (story: Correction["stories"][number]) => story.claims.map((claim) => `${escapeMarkdown(claimWording(claim))}\n\n${claim.evidenceIds.map(citation).join("\n\n")}`).join("\n\n");
  return [`# Observer Daily Brief — ${record.businessDate}`, `版本：${record.id.replace(/-record$/, "")} · ${withdrawn ? "Withdrawal · 部分撤稿" : "Correction · 事实更正"}`,
    ...(record.publicationMode === "test-fixture" ? ["> 固定输入与注入语义替身验证；未经过真实研究或生产准入。"] : record.publicationMode === "owner-requested" ? ["> 今日补发的修订版本 · Owner 显式请求；非定时准时交付。"] : []),
    `实际发布时间 ${record.publicationGate.checkedAtUtc}；${revision.severity === "major" ? "重大" : "轻微"}修订。原 Evidence Bundle ${escapeMarkdown(revision.originalBundleId)}（截稿 ${revision.originalCutoffUtc}）保持不变。`,
    `前版本 ${revision.previousVersionId} 的失效正文访问已撤销；[版本关系](/v1/archive/${record.businessDate})。${withdrawn ? "受影响栏目已撤回，错误尚未解决；旧结论不得继续作为有效事实。" : "受影响栏目仅采用本次通过 Publication Gate 的更正内容；旧结论失效。"}`,
    `受影响陈述：${revision.affected.map((item) => `${escapeMarkdown(item.versionId)}/${escapeMarkdown(item.storyId)}/${escapeMarkdown(item.claimId)}`).join("、")}。更正材料用途：correction-review；接收 ${revision.receivedAtUtc}。`,
    "## Today Overview",
    ...Object.entries(editionNames).map(([edition, name]) => `- [${name}](#edition-${edition})：${revision.affectedEditions.includes(edition as keyof typeof editionNames) ? withdrawn ? "已撤稿，存在未解重大错误" : "事实已更正，详见本栏" : "保留此前有效内容"}${record.coverageGaps.filter((gap) => gap.edition === edition).map((gap) => `；Coverage Gap（${escapeMarkdown(gap.reason)}）`).join("")}`),
    ...(Object.entries(editionNames).map(([edition, name]) => {
      const inherited = revision.inherited.find((entry) => entry.edition === edition);
      if (inherited) return inherited.markdown.trim();
      return [`<a id="edition-${edition}"></a>`, `## ${name}`,
        revision.affectedEditions.includes(edition as keyof typeof editionNames) ? withdrawn ? "### 已撤稿 · 等待可靠证据解决错误" : "### 更正说明与有效内容" : "Coverage Gap：此前无可读栏目内容。",
        ...record.stories.filter((story) => story.edition === edition).map(storyText),
      ].join("\n\n");
    })),
  ].join("\n\n") + "\n";
}
