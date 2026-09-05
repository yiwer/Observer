// Owner-authored Responses protocol fixture. No external model generated this content.
export const candidateOutput = {
  schemaVersion: 1, taskId: "task-fixture-2026-09-05", evidenceBundleId: "bundle-fixture-2026-09-05", configurationId: "fixture-config-v1",
  stories: [{ schemaVersion: 2, id: "story-1", eventClusterId: "event-1", edition: "frontier-technology", title: "示例观测站",
    claims: [{ id: "claim-1", kind: "fact", text: "示例观测站新增了 12 个观测点。", evidenceIds: ["evidence-1"] }] }],
};

export function modelResponseFixture() {
  const text = JSON.stringify(candidateOutput);
  const item = { id: "msg_fixture", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] };
  const response = { id: "resp_fixture", object: "response", created_at: 1788590000, model: "gpt-5.6-sol", status: "completed", output: [item],
    usage: { input_tokens: 12, input_tokens_details: { cached_tokens: 2 }, output_tokens: 21, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 33 } };
  const events = [
    { type: "response.created", response: { ...response, status: "in_progress", output: [], usage: null } },
    { type: "response.output_item.added", output_index: 0, item: { ...item, status: "in_progress", content: [] } },
    { type: "response.content_part.added", item_id: item.id, output_index: 0, content_index: 0, part: { type: "output_text", text: "", annotations: [] } },
    { type: "response.output_text.delta", item_id: item.id, output_index: 0, content_index: 0, delta: text },
    { type: "response.output_text.done", item_id: item.id, output_index: 0, content_index: 0, text },
    { type: "response.content_part.done", item_id: item.id, output_index: 0, content_index: 0, part: item.content[0] },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response },
  ];
  return events.map((event, sequence_number) => `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number })}\n\n`).join("");
}

export function usageResponseFixture(usage: unknown, rejectedTool = false) {
  const response = { id: "untrusted-response-id-must-not-be-retained", object: "response", model: "gpt-5.6-sol", status: "completed",
    output: rejectedTool ? [{ type: "function_call", name: "exec_command", call_id: "blocked-tool", arguments: '{"cmd":"must-not-execute"}' }] : [], usage };
  return `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response })}\n\n`;
}
