export const ownerToken = "test-owner-token-at-least-32-characters";
export const clock = () => "2026-09-04T23:40:00.000Z";
export const request = {
  schemaVersion: 1,
  taskId: "task-fixture-2026-09-05",
  businessDate: "2026-09-05",
  configurationId: "fixture-config-v1",
  evidenceBundle: {
    schemaVersion: 1,
    id: "bundle-fixture-2026-09-05",
    businessDate: "2026-09-05",
    configurationId: "fixture-config-v1",
    windowStartUtc: "2026-09-03T23:30:00.000Z",
    cutoffUtc: "2026-09-04T23:30:00.000Z",
    evidence: [{
      id: "evidence-1",
      sourceId: "source-fixture",
      sourceType: "primary",
      url: "https://example.org/observatory/update-42",
      title: "示例观测站发布第 42 次数据更新",
      eventTimeUtc: null,
      publishedAtUtc: "2026-09-04T22:00:00.000Z",
      discoveredAtUtc: "2026-09-04T22:05:00.000Z",
      retrievedAtUtc: "2026-09-04T22:06:00.000Z",
      content: "示例观测站发布第 42 次数据更新，新增 12 个观测点。",
      contentSha256: "2a1f33fabd68533caab5fd4dcd4ac785d35765c15620aa8c32b4988ec2023760",
    }],
  },
};
export const story = {
  schemaVersion: 1,
  id: "story-1",
  eventClusterId: "event-1",
  edition: "frontier-technology",
  title: "示例观测站新增 12 个观测点",
  claims: [{ text: "示例观测站发布第 42 次数据更新，新增 12 个观测点。", evidenceIds: ["evidence-1"] }],
};
export function successfulResult() {
  return {
    schemaVersion: 1,
    taskId: request.taskId,
    evidenceBundleId: request.evidenceBundle.id,
    configurationId: request.configurationId,
    provider: "fixture",
    model: "fixed-story-v1",
    runnerVersion: "fixture-v1",
    startedAtUtc: "2026-09-04T23:31:00.000Z",
    finishedAtUtc: "2026-09-04T23:32:00.000Z",
    status: "succeeded",
    stories: [structuredClone(story)],
    usage: { inputTokens: 10, outputTokens: 20 },
  };
}
