import { editionNames, type ReportRecord, type EditionResearch } from "./contracts.ts";
import type { Claim } from "./gate-contracts.ts";
import { claimWording, escapeMarkdown, failureExplanations, inputDigest } from "./publication-gate.ts";
import { consistentInterests } from "./interest-selection.ts";
import { domainLabels } from "./domain-evidence.ts";
import { consistentDiscourse } from "./discourse.ts";

type RecordV3 = Extract<ReportRecord, { schemaVersion: 3 }>;
type SixRecord = Extract<ReportRecord, { schemaVersion: 3 | 4 | 5 | 6 | 7 }>;
function canonicalTitle(story: RecordV3["stories"][number]): string {
  const fact = story.claims.find((claim) => claim.kind === "fact");
  if (fact) return fact.text;
  const leading = story.claims.find((claim) => claim.kind !== "quotation");
  return leading ? claimWording(leading) : "已核验引语";
}
const gapExplanations: Record<string, string> = {
  "social-no-eligible-source": "无合规社交来源：当前没有明确允许采样、模型处理、保留与不可撤回导出用途的来源；未将技术可访问视为用途许可。",
  "social-insufficient-sample": "未达到预先固定的采样门槛：故事关联讨论至少 6 条、平台原生信号至少 12 条；不降低门槛补造观察。",
  "social-below-target": "本栏合格话语观察不足约 7 组软目标；故事关联讨论不成为独立新闻事件。",
  "social-skewed": "样本偏斜：重复比例过高，或缺少预先固定的原发根帖/时间桶覆盖；不推断总体意见。",
  "social-rate-limited": "实例限流，采样或复查未完成；本轮未取得足够的合规观察。",
  "social-unavailable": "样本在本实例复查不可用；可能已删除或访问条件改变，未将不可用断言为作者已删除。",
  "social-access-unavailable": "实例当前未提供获准的公开访问，未改用账户或其他实例绕过。",
  "social-changed": "截稿后的复查发现样本表示变化，旧分析已隔离，未替换成后来的正文。",
  "social-recheck-incomplete": "样本复查未完成，无法继续采用旧分析。",
  "social-pagination-incomplete": "分页边界缺失、异常或达到有界页数；未声称观察完整时间窗。",
  "social-after-cutoff": "普通样本在截稿后才取得，未回填取得时间进入当期。",
  "social-permission-changed": "来源许可已变化或撤回，对应社会材料和分析已隔离。",
  "social-expired": "社会样本的获准短存期限已到，未继续送入模型或永久报告。",
  "social-snapshot-unavailable": "本期没有可验证的采样收据；重启或快照丢失后明确缺样。",
  "social-snapshot-invalid": "样本身份、配置、时间或计数不一致，对应组已隔离。",
  "social-main-story-unavailable": "未找到本期通过核验且唯一入选的主 Event Cluster，故事关联观察未刊登。",
  "social-analysis-unavailable": "样本分析缺失、未通过核验或组身份不唯一，未刊登观察。",
  "social-interest-excluded": "平台原生观察被本期明确兴趣排除；它不取得 Global Baseline 或人口地域资格。",
  "social-capacity-limit": "本期平台原生观察达到选题容量，未为数量目标扩展采样或改写阈值。",
  "social-collected-bundle-required": "社会采样须与具有真实策略身份的 Collected Bundle 配合，未借旧固定证据壳伪造来源许可。",
  "social-cancelled": "采样或复查已取消，本组材料不足。",
  "social-timeout": "采样或复查达到有界时限，本组材料不足。",
  "social-invalid-response": "平台响应结构或安全字段无法确认，本组材料不足。",
  "social-sample-limit": "达到预先固定的样本预算，分页观察未完成。",
  "social-response-too-large": "平台响应超过已配置字节上限，未处理超限材料。",
  "social-unsafe-response": "平台响应改变了获准请求位置，本轮未采用材料。",
  "below-story-target": "通过发布门的候选不足约 7 条软目标，按实际内容刊登，不补造材料。",
  "below-interest-selection-target": "通过硬门、事件去重及兴趣与地域筛选后，本栏入选不足约 7 条软目标；按实际内容刊登，不补造材料。",
  "no-evidence": "未取得可用证据，未运行该栏研究。",
  "no-candidates": "研究已完成，但未返回候选。",
  "candidates-rejected": "候选陈述未通过发布门，详见本栏待确认或隔离原因。",
  "editorial-reference-unavailable": "编辑分析引用缺失或未通过核验，对应说明与 Impact Note 未生成。",
  "legacy-history-unclassified": "此前报告缺少已核验的事件身份，历史覆盖尚未完全分类；当前条目仍按本期证据选题。",
};
function gapText(reason: string): string {
  if (gapExplanations[reason]) return gapExplanations[reason];
  if (reason.startsWith("agent-")) return `研究运行未完成（${reason.slice(6)}），本栏内容缺失。`;
  return reason;
}

export function consistentRecord(record: SixRecord): boolean {
  if (record.schemaVersion === 7 && !consistentDiscourse(record)) return false;
  if ((record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) && !consistentInterests(record)) return false;
  const gate = record.publicationGate;
  if (gate.schemaVersion === 2) {
    const identity = { taskId: record.taskId, evidenceBundleId: record.evidenceBundle.id, configurationId: record.configurationId };
    if (gate.input.inputSha256 !== inputDigest({ schemaVersion: 2, ...identity, batchInputSha256s: gate.batches.map((batch) => batch.input.inputSha256) }) ||
      gate.batches.some((batch, index) => batch.input.taskId !== `verification-${inputDigest([record.taskId, index])}` ||
        batch.input.evidenceBundleId !== record.evidenceBundle.id || batch.input.configurationId !== record.configurationId || batch.checkedAtUtc > gate.checkedAtUtc ||
        batch.verification !== null && batch.verification.inputSha256 !== batch.input.inputSha256)) return false;
  }
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

export function arrangeEditions(record: Omit<Extract<ReportRecord, { schemaVersion: 2 }>, "publicationGate"> & Pick<RecordV3, "publicationGate">, research: EditionResearch): RecordV3 {
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
export function sixEditionMarkdown(record: SixRecord): string {
  const anchor = (id: string) => `story-${record.stories.findIndex((story) => story.id === id) + 1}`;
  const sources = (ids: string[]) => ids.map((id) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === id)!;
    const policy = record.sourcePolicyDecisions.find((item) => item.evidenceId === id);
    const url = evidence.url!.replace(/[<>\s]/g, (character) => encodeURIComponent(character));
    return `来源：${policy?.decision === "source-policy-v1" ? escapeMarkdown(policy.attribution) + " — " : ""}[直达原始材料](<${url}>) [${escapeMarkdown(id)}]`;
  }).join("\n\n");
  const claimText = (claim: Claim, storyId: string) => `${escapeMarkdown(claimWording(claim))}${(record.schemaVersion === 6 || record.schemaVersion === 7) && domainLabels(record, storyId, claim.id) ? `\n\n${domainLabels(record, storyId, claim.id)}` : ""}\n\n${sources(claim.evidenceIds)}`;
  const storyClaimText = (storyId: string, claim: Claim) => {
    const development = record.schemaVersion === 4 || (record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? record.eventClusters.flatMap((cluster) => cluster.developments).find((entry) => entry.storyId === storyId && entry.claimId === claim.id) : undefined;
    return `${development?.coverage === "late-discovered" ? `补报事实（Late-discovered Story）：首次公开披露 ${development.disclosure.atUtc}。\n\n` : ""}${claimText(claim, storyId)}`;
  };
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    `版本：${record.businessDate}-v1 · 正文契约：${record.editorialContract}`,
    "> 自动化标注替身产物；未经过真实研究或生产准入。",
    "## Today Overview",
    ...((record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? [`Interest Profile：v${record.interestProfile.profile.version}；本期开始时固定，后续导入仅用于下一次生成。`,
      "选题顺序：来源与发布门、事件窗口与去重、Global Baseline / 显式排除、偏好优先级；每栏约 7 条、3 条重点。",
      `覆盖范围：本期进入核验的获准证据 ${record.coverage.inputEvidenceCount} 条；以下地域为已核验事件涉及地域，语言为所见获准材料的标注语言。目标列表不代表采集或翻译能力，也不代表完整全球召回。`,
      `地域证据：${record.coverage.regions.map((entry) => `${entry.key} ${entry.evidenceIds.length}`).join("、")}；未知地域证据 ${record.coverage.unknownRegionEvidenceIds.length}。`,
      `语言证据：${record.coverage.languages.map((entry) => `${entry.key} ${entry.evidenceIds.length}`).join("、")}；未知语言证据 ${record.coverage.unknownLanguageEvidenceIds.length}。`,
      ...record.coverage.regions.filter((entry) => !entry.evidenceIds.length).map((entry) => `Coverage Gap：地域缺口：${entry.key}（本期无带有效地域标注的获准证据，不表示没有新闻）。`),
      ...record.coverage.languages.filter((entry) => !entry.evidenceIds.length).map((entry) => `Coverage Gap：语言盲区：${entry.key}（目标语言没有有效标注证据）。`),
      ...(record.coverage.unknownRegionEvidenceIds.length || record.coverage.unknownLanguageEvidenceIds.length ? ["Coverage Gap：部分证据的地域或语言未知；未从域名或缺省值推断。"] : []),
    ] : []),
    ...record.editions.map((entry) => {
      const leading = record.stories.find((story) => story.id === entry.storyIds[0]);
      const gaps = record.coverageGaps.filter((gap) => gap.edition === entry.edition);
      const social = record.schemaVersion === 7 && entry.edition === "social-discourse" ? `已核验 ${record.discourse.observations.length} 组样本观察` : null;
      return `- [${editionNames[entry.edition]}](#edition-${entry.edition})：${social ?? (leading ? `[${escapeMarkdown(leading.title)}](#${anchor(leading.id)})` : "暂无可发布故事")}${gaps.map((gap) => `；Coverage Gap（${escapeMarkdown(gapText(gap.reason))}）`).join("")}`;
    }),
    ...record.editions.flatMap((entry) => [
      `<a id="edition-${entry.edition}"></a>`, `## ${editionNames[entry.edition]}`,
      record.schemaVersion === 7 && entry.edition === "social-discourse" ? `本栏实际 ${record.discourse.observations.length} 组话语观察；约 7 组、约 3 组重点为软目标。故事关联讨论不占独立新闻事件位置。` : `本栏实际 ${entry.storyIds.length} 条 · 重点 ${entry.priorityStoryIds.length} 条。约 7 条、约 3 条重点均为软目标。`,
      ...record.coverageGaps.filter((gap) => gap.edition === entry.edition).map((gap) => `Coverage Gap：${escapeMarkdown(gapText(gap.reason))}`),
      ...(record.schemaVersion === 7 && entry.edition === "social-discourse" ? record.discourse.groups.flatMap((group) => [
        `平台：${group.platform}；查询：${group.query}；仅本实例公开本地帖子，未声称全网覆盖。`,
        `观察窗口：${group.windowStartUtc} — ${group.cutoffUtc}；语言：${group.language ?? "未知"}；地域依据：未知；样本量：${group.sampleSize ?? "未知（未采集）"}。`,
        ...(group.reason ? [`Coverage Gap：${gapText(group.reason)}`] : []),
        ...(group.sampleSize !== null ? [`收到 ${group.receivedCount} 条；重复 ${group.duplicateCount} 条；隔离 ${group.isolatedCount} 条；不同原发根帖 ${group.rootCount} 个，两个预先固定时间桶 ${group.bucketCounts?.join(" / ")} 条。作者数未知；根帖不是独立可靠来源，未读取完整线程，不表示随机或代表性抽样。`] : []),
        ...record.discourse.observations.filter((observation) => observation.groupId === group.id).flatMap((observation) => [
          `### ${observation.priority ? "重点 · " : ""}${observation.kind === "story-linked" ? "Story-linked Discourse（故事关联讨论）" : "Platform-native Signal（平台原生信号候选，非新闻事实）"}`,
          ...(observation.kind === "story-linked" ? [`主 Event Cluster：${observation.linkedClusterId}；[主栏全文](#${anchor(observation.primaryStoryId!)})；不作为主故事的独立事实证明。`] : []),
          ...observation.story.claims.map((claim) => claimText(claim, observation.story.id)),
        ]),
      ]) : []),
      ...entry.storyIds.flatMap((id) => {
        const story = record.stories.find((story) => story.id === id)!;
        const priority = entry.priorityStoryIds.includes(id);
        const editorial = record.storyEditorial.find((entry) => entry.storyId === id)!;
        const sections = [
          ["事件", story.claims.filter((claim) => claim.kind !== "analysis").map((claim) => claim.id)],
          ["意义", editorial.significanceClaimIds], ["影响路径", editorial.impactClaimIds], ["未知", editorial.uncertaintyClaimIds],
        ] as const;
        return [`<a id="${anchor(story.id)}"></a>`, `### ${priority ? "重点" : "关注"} · ${escapeMarkdown(story.title)}`,
          ...((record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? record.interestSelections.filter((selection) => selection.storyId === story.id).map((selection) =>
            `选题依据：${selection.baseline ? "Global Baseline（经核验的全球或重大区域影响，保留跨兴趣排除的资格）" : "显式兴趣与常规地域策略"}；偏好优先级合计 ${selection.score}。`) : []),
          ...(record.schemaVersion === 4 || (record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? record.eventClusters.filter((cluster) => cluster.primary.storyId === story.id).flatMap((cluster) => [
            ...(cluster.eventKind === "publisher-statement" ? ["事件身份：发布者公开作出声明；声明内容不等同于已证事实。"] : []),
            ...(cluster.coverage === "material-update" ? [`实质新进展；前次报道：${cluster.previousCoverage!.versionId} / ${escapeMarkdown(cluster.previousCoverage!.storyId)}。`] : []),
            ...(cluster.coverage === "late-discovered" ? ["补报（Late-discovered Story）：披露早于本期窗口，当前仍具重大价值。"] : []),
            ...cluster.separatedFrom.map((relation) => `后续拆分关联：${escapeMarkdown(relation.versionId)} / ${escapeMarkdown(relation.clusterId)}；依据本期事实重新区分事件，旧版本保持原样，正式更正状态由后续更正流程处理。`),
            ...(cluster.historyMetadata === "source-policy-withheld" ? ["历史时间元数据因当前来源权限不可分发；仅保留去重指纹与前次版本关联。"] : []),
            `事件发生：${cluster.occurrence.atUtc ?? "未知"}；首次公开披露：${cluster.firstDisclosure.atUtc ?? "未知"}；首次发现：${cluster.firstDiscoveredAtUtc ?? "未知"}；实质进展发生：${cluster.materialDevelopment.atUtc ?? "未知"}。`,
          ]) : []),
          ...(priority ? sections.flatMap(([label, ids]) => [`#### ${label}`, ...(ids.length ? ids.map((id) => storyClaimText(story.id, story.claims.find((claim) => claim.id === id)!)) : [`内容缺口：未提供通过核验的${label}陈述。`])]) : story.claims.map((claim) => storyClaimText(story.id, claim))),
          ...(priority ? story.claims.filter((claim) => !sections.some(([, ids]) => ids.includes(claim.id))).map((claim) => storyClaimText(story.id, claim)) : []),
          ...(record.schemaVersion === 4 || (record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? record.eventClusters.filter((cluster) => cluster.primary.storyId === story.id).flatMap((cluster) => cluster.supportingClaims.map((entry) => storyClaimText(entry.storyId, entry.claim))) : []),
        ];
      }),
      ...record.storyEditorial.flatMap((editorial) => editorial.impactNotes.filter((note) => note.edition === entry.edition).flatMap((note) => {
        const primary = record.stories.find((story) => story.id === editorial.storyId)!;
        return ["### Impact Note（不占普通条目）", `[主栏全文：${escapeMarkdown(primary.title)}](#${anchor(primary.id)})`, ...note.claimIds.map((id) => claimText(primary.claims.find((claim) => claim.id === id)!, primary.id))];
      })),
      ...(record.schemaVersion === 4 || (record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) ? record.eventClusters.filter((cluster) => cluster.primary.edition !== entry.edition && cluster.memberStoryIds.some((id) => entry.candidateStoryIds.includes(id)) && !record.storyEditorial.some((editorial) => editorial.storyId === cluster.primary.storyId && editorial.impactNotes.some((note) => note.edition === entry.edition))).flatMap((cluster) => {
        const primary = record.stories.find((story) => story.id === cluster.primary.storyId)!;
        const note = cluster.impactNotes.find((note) => note.edition === entry.edition)!;
        return ["### Impact Note（不占普通条目）", `[主栏全文：${escapeMarkdown(primary.title)}](#${anchor(primary.id)})`, `关联版本：${cluster.primary.versionId}。`,
          ...(note.claims.length ? note.claims.map((entry) => claimText(entry.claim, entry.storyId)) : ["影响说明缺口：本栏未提供通过核验的影响分析，详见主栏全文。"])];
      }) : []),
      ...record.publicationGate.unconfirmedItems.filter((item) => item.edition === entry.edition).flatMap((item) => [
        "### 待确认", `待确认说法（非已证事实）：${escapeMarkdown(item.description)}`,
        ...((record.schemaVersion === 6 || record.schemaVersion === 7) && domainLabels(record, item.storyId, item.claimId) ? [domainLabels(record, item.storyId, item.claimId)] : []),
        ...item.evidenceIds.map((id) => {
          const evidence = record.evidenceBundle.evidence.find((entry) => entry.id === id)!;
          const gate = record.publicationGate;
          const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
          const relation = assessments.find((entry) => entry.storyId === item.storyId && entry.claimId === item.claimId)?.evidence.find((entry) => entry.evidenceId === id)?.relation;
          return `${escapeMarkdown(evidence.sourceId)}（${relation === "contradicts" ? "提供相反材料" : relation === "supports" ? "提供支持材料" : "关系未确认"}）\n\n${sources([id])}`;
        }),
      ]),
      ...record.publicationGate.decisions.filter((decision) => decision.outcome !== "published" && entry.candidateStoryIds.includes(decision.storyId)).map((decision) =>
        `${decision.outcome === "unconfirmed" ? "待确认" : "隔离项"} [${escapeMarkdown(decision.storyId)}/${escapeMarkdown(decision.claimId)}]：${failureExplanations[decision.reason] ?? "该陈述未通过发布门。"} (${decision.reason})`),
    ]),
  ].join("\n\n") + "\n";
}
