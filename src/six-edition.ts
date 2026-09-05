import { editionNames, type ReportRecord, type EditionResearch } from "./contracts.ts";
import type { Claim } from "./gate-contracts.ts";
import { claimWording, escapeMarkdown, failureExplanations, inputDigest } from "./publication-gate.ts";

type RecordV3 = Extract<ReportRecord, { schemaVersion: 3 }>;
function canonicalTitle(story: RecordV3["stories"][number]): string {
  const fact = story.claims.find((claim) => claim.kind === "fact");
  if (fact) return fact.text;
  const leading = story.claims.find((claim) => claim.kind !== "quotation");
  return leading ? claimWording(leading) : "已核验引语";
}
const gapExplanations: Record<string, string> = {
  "below-story-target": "通过发布门的候选不足约 7 条软目标，按实际内容刊登，不补造材料。",
  "no-evidence": "未取得可用证据，未运行该栏研究。",
  "no-candidates": "研究已完成，但未返回候选。",
  "candidates-rejected": "候选陈述未通过发布门，详见本栏待确认或隔离原因。",
  "editorial-reference-unavailable": "编辑分析引用缺失或未通过核验，对应说明与 Impact Note 未生成。",
};
function gapText(reason: string): string {
  if (gapExplanations[reason]) return gapExplanations[reason];
  if (reason.startsWith("agent-")) return `研究运行未完成（${reason.slice(6)}），本栏内容缺失。`;
  return reason;
}

export function consistentRecord(record: RecordV3): boolean {
  const gate = record.publicationGate;
  if (gate.input.taskId !== record.taskId || gate.input.evidenceBundleId !== record.evidenceBundle.id || gate.input.configurationId !== record.configurationId ||
    record.editions.some((entry, index) => entry.edition !== Object.keys(editionNames)[index]) || new Set(record.stories.map((story) => story.id)).size !== record.stories.length) return false;
  if (!record.editions.every((entry) => entry.storyIds.length === new Set(entry.storyIds).size && entry.storyIds.every((id) => record.stories.some((story) => story.id === id && story.edition === entry.edition)) && entry.priorityStoryIds.every((id) => entry.storyIds.includes(id)))) return false;
  if (!record.stories.every((story) => record.editions.some((entry) => entry.storyIds.includes(story.id)) && story.title === canonicalTitle(story) && story.claims.every((claim) => {
    const decisions = gate.decisions.filter((decision) => decision.storyId === story.id && decision.claimId === claim.id);
    return decisions.length === 1 && decisions[0]!.outcome === "published" && decisions[0]!.inputClaimSha256 === inputDigest(claim) && claim.evidenceIds.every((id) => record.evidenceBundle.evidence.some((item) => item.id === id && item.url && item.title));
  }))) return false;
  return record.storyEditorial.length === record.stories.length && new Set(record.storyEditorial.map((entry) => entry.storyId)).size === record.stories.length && record.storyEditorial.every((entry) => {
    const story = record.stories.find((story) => story.id === entry.storyId);
    return story && [...entry.significanceClaimIds, ...entry.impactClaimIds, ...entry.uncertaintyClaimIds, ...entry.impactNotes.flatMap((note) => note.claimIds)].every((id) => story.claims.some((claim) => claim.id === id && claim.kind === "analysis")) && entry.impactNotes.every((note) => note.edition !== story.edition);
  });
}

export function arrangeEditions(record: Extract<ReportRecord, { schemaVersion: 2 }>, research: EditionResearch): RecordV3 {
  const { agentResult: _agentResult, ...base } = record;
  const editions = (Object.keys(editionNames) as Array<keyof typeof editionNames>).map((edition) => {
    const run = research.editions.find((entry) => entry.edition === edition)!;
    const selected = record.stories.filter((story) => story.edition === edition).slice(0, 7);
    return { edition, candidateStoryIds: run.status === "completed" && run.result.status === "succeeded" ? run.result.stories.map((story) => story.id) : [],
      storyIds: selected.map((story) => story.id), priorityStoryIds: selected.slice(0, 3).map((story) => story.id) };
  });
  const stories = record.stories.filter((story) => editions.some((edition) => edition.storyIds.includes(story.id))).map((story) => ({ ...story, title: canonicalTitle(story) }));
  const storyEditorial = stories.map((story) => {
    const run = research.editions.find((entry) => entry.edition === story.edition)!;
    const proposed = run.status === "completed" ? run.editorial?.find((entry) => entry.storyId === story.id) : undefined;
    const analysisIds = (ids: string[]) => [...new Set(ids)].filter((id) => story.claims.some((claim) => claim.id === id && claim.kind === "analysis"));
    return { storyId: story.id, significanceClaimIds: analysisIds(proposed?.significanceClaimIds ?? []), impactClaimIds: analysisIds(proposed?.impactClaimIds ?? []), uncertaintyClaimIds: analysisIds(proposed?.uncertaintyClaimIds ?? []),
      impactNotes: (proposed?.impactNotes ?? []).filter((note) => note.edition !== story.edition).map((note) => ({ edition: note.edition, claimIds: analysisIds(note.claimIds) })).filter((note) => note.claimIds.length > 0) };
  });
  const editorialGaps = research.editions.filter((run) => run.status === "completed" && run.editorial?.some((proposed) => {
    const story = stories.find((story) => story.id === proposed.storyId && story.edition === run.edition);
    return !story || [...proposed.significanceClaimIds, ...proposed.impactClaimIds, ...proposed.uncertaintyClaimIds, ...proposed.impactNotes.flatMap((note) => note.claimIds)].some((id) => !story.claims.some((claim) => claim.id === id && claim.kind === "analysis")) || proposed.impactNotes.some((note) => note.edition === story.edition);
  })).map((run) => ({ edition: run.edition, reason: "editorial-reference-unavailable" }));
  return { ...base, schemaVersion: 3, editorialContract: "observer-canonical-v1", editions, stories, storyEditorial,
    coverageGaps: [
      ...editorialGaps,
      ...editions.filter((entry) => entry.storyIds.length < 7).map((entry) => ({ edition: entry.edition, reason: "below-story-target" })),
      ...editions.filter((entry) => record.publicationGate.decisions.some((decision) => entry.candidateStoryIds.includes(decision.storyId) && decision.outcome !== "published")).map((entry) => ({ edition: entry.edition, reason: "candidates-rejected" })),
      ...research.editions.filter((entry) => entry.status === "no-evidence").map((entry) => ({ edition: entry.edition, reason: "no-evidence" })),
      ...research.editions.filter((entry) => entry.status === "invalid-output").map((entry) => ({ edition: entry.edition, reason: "agent-invalid-output" })),
      ...research.editions.flatMap((entry) => entry.status !== "completed" ? [] : entry.result.status !== "succeeded" ? [{ edition: entry.edition, reason: `agent-${entry.result.failure.category}` }] : !entry.result.stories.length ? [{ edition: entry.edition, reason: "no-candidates" }] : []),
      ...record.evidenceBundle.coverageGaps.map((gap) => ({ edition: gap.edition, reason: `source-gap:${gap.sourceId}:${gap.reason}` })),
    ],
    editionRuns: research.editions.map((entry) => entry.status !== "completed" ? entry : { edition: entry.edition, status: entry.status, result: entry.result.status === "succeeded" ? (({ stories: _stories, ...metadata }) => metadata)(entry.result) : entry.result }),
  };
}

// Deterministic Final Editor: no raw candidate prose, model, I/O or tool capabilities.
export function sixEditionMarkdown(record: RecordV3): string {
  const anchor = (id: string) => `story-${record.stories.findIndex((story) => story.id === id) + 1}`;
  const sources = (ids: string[]) => ids.map((id) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === id)!;
    const policy = record.sourcePolicyDecisions.find((item) => item.evidenceId === id);
    const url = evidence.url!.replace(/[<>\s]/g, (character) => encodeURIComponent(character));
    return `来源：${policy?.decision === "source-policy-v1" ? escapeMarkdown(policy.attribution) + " — " : ""}[直达原始材料](<${url}>) [${escapeMarkdown(id)}]`;
  }).join("\n\n");
  const claimText = (claim: Claim) => `${escapeMarkdown(claimWording(claim))}\n\n${sources(claim.evidenceIds)}`;
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    `版本：${record.businessDate}-v1 · 正文契约：${record.editorialContract}`,
    "> 自动化标注替身产物；未经过真实研究或生产准入。",
    "## Today Overview",
    ...record.editions.map((entry) => {
      const leading = record.stories.find((story) => story.id === entry.storyIds[0]);
      const gaps = record.coverageGaps.filter((gap) => gap.edition === entry.edition);
      return `- [${editionNames[entry.edition]}](#edition-${entry.edition})：${leading ? `[${escapeMarkdown(leading.title)}](#${anchor(leading.id)})` : "暂无可发布故事"}${gaps.map((gap) => `；Coverage Gap（${escapeMarkdown(gapText(gap.reason))}）`).join("")}`;
    }),
    ...record.editions.flatMap((entry) => [
      `<a id="edition-${entry.edition}"></a>`, `## ${editionNames[entry.edition]}`,
      `本栏实际 ${entry.storyIds.length} 条 · 重点 ${entry.priorityStoryIds.length} 条。约 7 条、约 3 条重点均为软目标。`,
      ...record.coverageGaps.filter((gap) => gap.edition === entry.edition).map((gap) => `Coverage Gap：${escapeMarkdown(gapText(gap.reason))}`),
      ...entry.storyIds.flatMap((id) => {
        const story = record.stories.find((story) => story.id === id)!;
        const priority = entry.priorityStoryIds.includes(id);
        const editorial = record.storyEditorial.find((entry) => entry.storyId === id)!;
        const sections = [
          ["事件", story.claims.filter((claim) => claim.kind !== "analysis").map((claim) => claim.id)],
          ["意义", editorial.significanceClaimIds], ["影响路径", editorial.impactClaimIds], ["未知", editorial.uncertaintyClaimIds],
        ] as const;
        return [`<a id="${anchor(story.id)}"></a>`, `### ${priority ? "重点" : "关注"} · ${escapeMarkdown(story.title)}`,
          ...(priority ? sections.flatMap(([label, ids]) => [`#### ${label}`, ...(ids.length ? ids.map((id) => claimText(story.claims.find((claim) => claim.id === id)!)) : [`内容缺口：未提供通过核验的${label}陈述。`])]) : story.claims.map(claimText)),
          ...(priority ? story.claims.filter((claim) => !sections.some(([, ids]) => ids.includes(claim.id))).map(claimText) : []),
        ];
      }),
      ...record.storyEditorial.flatMap((editorial) => editorial.impactNotes.filter((note) => note.edition === entry.edition).flatMap((note) => {
        const primary = record.stories.find((story) => story.id === editorial.storyId)!;
        return ["### Impact Note（不占普通条目）", `[主栏全文：${escapeMarkdown(primary.title)}](#${anchor(primary.id)})`, ...note.claimIds.map((id) => claimText(primary.claims.find((claim) => claim.id === id)!))];
      })),
      ...record.publicationGate.unconfirmedItems.filter((item) => item.edition === entry.edition).flatMap((item) => [
        "### 待确认", `待确认说法（非已证事实）：${escapeMarkdown(item.description)}`,
        ...item.evidenceIds.map((id) => {
          const evidence = record.evidenceBundle.evidence.find((entry) => entry.id === id)!;
          const relation = record.publicationGate.verification?.assessments.find((entry) => entry.storyId === item.storyId && entry.claimId === item.claimId)?.evidence.find((entry) => entry.evidenceId === id)?.relation;
          return `${escapeMarkdown(evidence.sourceId)}（${relation === "contradicts" ? "提供相反材料" : relation === "supports" ? "提供支持材料" : "关系未确认"}）\n\n${sources([id])}`;
        }),
      ]),
      ...record.publicationGate.decisions.filter((decision) => decision.outcome !== "published" && entry.candidateStoryIds.includes(decision.storyId)).map((decision) =>
        `${decision.outcome === "unconfirmed" ? "待确认" : "隔离项"} [${escapeMarkdown(decision.storyId)}/${escapeMarkdown(decision.claimId)}]：${failureExplanations[decision.reason] ?? "该陈述未通过发布门。"} (${decision.reason})`),
    ]),
  ].join("\n\n") + "\n";
}
