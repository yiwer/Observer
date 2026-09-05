import { candidateOutput } from "./model-responses.ts";

// Owner-authored Messages API samples, with inert fictional evidence.
export function claudeMessageFixture(content: Record<string, unknown>[] = [{ type: "tool_use", id: "tool_fixture", name: "StructuredOutput", input: candidateOutput }], stopReason = "tool_use") {
  const events = [
    { type: "message_start", message: { id: "msg_fixture", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0, cache_read_input_tokens: 2, cache_creation_input_tokens: 0 } } },
    ...content.flatMap((block, index) => [
      { type: "content_block_start", index, content_block: block.type === "tool_use" ? { ...block, input: {} } : { ...block, text: "" } },
      { type: "content_block_delta", index, delta: block.type === "tool_use" ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: block.text } },
      { type: "content_block_stop", index },
    ]),
    { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 21 } },
    { type: "message_stop" },
  ];
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}
