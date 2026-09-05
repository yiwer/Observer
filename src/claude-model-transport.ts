import { z } from "zod";
import { CandidateOutput } from "./agent-candidate.ts";
import { messageEvents, readMessagesAccounting } from "./claude-usage.ts";

export interface ClaudeModelTransport {
  readonly provenance: "model-protocol-fixture" | "anthropic-api";
  respond(body: Record<string, unknown>, signal: AbortSignal): Promise<{ status: number; body: string }>;
}

// Only explicit API credentials; never ambient OAuth, profiles or endpoints.
export function createAnthropicModelTransport(apiKey: string): ClaudeModelTransport {
  if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error("invalid-model-credential");
  return { provenance: "anthropic-api", async respond(body, signal) {
    const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", redirect: "error", signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    if (reader) {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 2 * 1024 * 1024) throw new Error("model-output-limit");
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
    }
    return { status: response.status, body: Buffer.concat(chunks).toString("utf8") };
  } };
}

const InputText = z.object({ type: z.literal("text"), text: z.string() });
const InputBlock = z.discriminatedUnion("type", [
  InputText,
  z.object({ type: z.literal("thinking"), thinking: z.string(), signature: z.string() }),
  z.object({ type: z.literal("redacted_thinking"), data: z.string() }),
  z.object({ type: z.literal("tool_use"), id: z.string().min(1), name: z.literal("StructuredOutput"), input: CandidateOutput }),
  z.object({ type: z.literal("tool_result"), tool_use_id: z.string().min(1), is_error: z.boolean().optional(),
    content: z.union([z.string(), z.array(InputText)]) }),
]);
const ModelInput = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.union([z.string(), z.array(InputBlock)]) })).min(1),
  system: z.union([z.string(), z.array(InputText)]).optional(),
});

export function claudeModelRequest(body: Record<string, unknown>, schema: unknown) {
  // Text and verified data-tool history cannot ask the provider to fetch a URL,
  // read a file ID, or process nested image/document/tool-result attachments.
  const input = ModelInput.parse(body);
  // Never forward remote MCP, server tools, containers, metadata or beta settings.
  return { model: "claude-sonnet-4-6", ...input, max_tokens: 32_000,
    thinking: { type: "adaptive" }, output_config: { effort: "high" }, stream: true,
    tools: [{ name: "StructuredOutput", description: "Return the candidate data matching this schema. This tool has no external side effects.", input_schema: schema }], tool_choice: { type: "auto" } };
}

const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("thinking"), thinking: z.string(), signature: z.string().optional() }),
  z.object({ type: z.literal("redacted_thinking"), data: z.string() }),
  z.object({ type: z.literal("tool_use"), id: z.string().min(1), name: z.literal("StructuredOutput"), input: z.unknown() }),
]);
function completeBlock(value: unknown) {
  const block = Block.parse(value);
  if (block.type === "tool_use") CandidateOutput.parse(block.input);
  return block;
}

// Validate complete streams before executable provider output can reach the CLI.
// StructuredOutput is a schema-checked data return, never a shell or MCP tool.
export function claudeResponseAllowed(body: string): boolean {
  try {
    if (!readMessagesAccounting(body, "claude-sonnet-4-6").consistent) return false;
    const events = [...messageEvents(body)];
    if (events.length === 1 && events[0]!.type === "message") {
      const message = z.object({ role: z.literal("assistant"), model: z.literal("claude-sonnet-4-6"), content: z.array(z.unknown()), stop_reason: z.string() }).parse(events[0]);
      message.content.forEach(completeBlock);
      return true;
    }
    let started = false, ended = false, finalDelta = false;
    let stopReason: string | null | undefined;
    let active: { index: number; block: z.infer<typeof Block>; json: string } | undefined;
    let index = 0;
    const toolIds = new Set<string>();
    for (const event of events) {
      if (event.type === "ping") continue;
      if (ended) return false;
      if (event.type === "message_start") {
        if (started) return false;
        z.object({ role: z.literal("assistant"), model: z.literal("claude-sonnet-4-6"), content: z.tuple([]) }).parse(event.message);
        started = true;
      } else if (!started) return false;
      else if (event.type === "content_block_start") {
        if (active || finalDelta || event.index !== index++) return false;
        active = { index: event.index as number, block: Block.parse(event.content_block), json: "" };
        if (active.block.type === "tool_use") {
          if (toolIds.has(active.block.id) || toolIds.size >= 1) return false;
          toolIds.add(active.block.id);
        }
      } else if (event.type === "content_block_delta") {
        if (!active || event.index !== active.index) return false;
        const delta = z.object({ type: z.string() }).passthrough().parse(event.delta);
        if (active.block.type === "tool_use" && delta.type === "input_json_delta") active.json += z.string().parse(delta.partial_json);
        else if (active.block.type === "text" && delta.type === "text_delta") z.string().parse(delta.text);
        else if (active.block.type === "thinking" && ["thinking_delta", "signature_delta"].includes(delta.type)) z.string().parse(delta.thinking ?? delta.signature);
        else return false;
      } else if (event.type === "content_block_stop") {
        if (!active || event.index !== active.index) return false;
        if (active.block.type === "tool_use") CandidateOutput.parse(active.json ? JSON.parse(active.json) : active.block.input);
        active = undefined;
      } else if (event.type === "message_delta") {
        if (active) return false;
        const delta = z.object({ stop_reason: z.enum(["end_turn", "tool_use", "refusal", "max_tokens", "stop_sequence"]).nullish(), stop_sequence: z.null().optional() }).parse(event.delta);
        if (stopReason && delta.stop_reason !== undefined && stopReason !== delta.stop_reason) return false;
        if (delta.stop_reason !== undefined) stopReason = delta.stop_reason;
        finalDelta = true;
      } else if (event.type === "message_stop") {
        if (active || !finalDelta || !stopReason) return false;
        ended = true;
      } else return false;
    }
    return ended;
  } catch { return false; }
}
