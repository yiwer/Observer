import { z } from "zod";
import { CandidateV2Schema, VerificationSchema, type VerificationInput, type Verification } from "./gate-contracts.ts";
import type { ProduceRequest } from "./contracts.ts";
import { CandidateOutput } from "./agent-candidate.ts";

export const codexVersion = "codex-cli 0.153.4";
const count = z.number().int().nonnegative().nullable();
const Usage = z.object({ input_tokens: count.optional(), output_tokens: count.optional(), cached_input_tokens: count.optional(), cache_write_input_tokens: count.optional(), reasoning_output_tokens: count.optional() });
const Frame = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("version"), value: z.string() }),
  z.strictObject({ kind: z.literal("event"), line: z.string() }),
  z.strictObject({ kind: z.literal("stderr"), bytes: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal("refusal"), reason: z.enum(["method", "path", "host", "encoding", "request-size", "model", "request"]) }),
  z.strictObject({ kind: z.literal("result"), exitCode: z.number().int(), final: z.string().nullable() }),
]);

// This grammar belongs to the adapter. The business layer never consumes CLI events.
export function readCodexResult(stdout: string, task: ProduceRequest, edition: string) {
  return readCodexProtocol(stdout, (value) => {
    const output = CandidateOutput.parse(value);
    if (output.taskId !== task.taskId || output.evidenceBundleId !== task.evidenceBundle.id || output.configurationId !== task.configurationId || output.stories.some((story) => story.edition !== edition)) throw new Error();
    return output.stories;
  });
}

export function readCodexVerification(stdout: string, input: VerificationInput) {
  let verification: Verification | null = null;
  const result = readCodexProtocol(stdout, (value) => {
    const output = VerificationSchema.parse(value);
    if (output.inputSha256 !== input.inputSha256) throw new Error();
    verification = output; return [];
  });
  return { ...result, verification };
}

function readCodexProtocol(stdout: string, accept: (value: unknown) => z.infer<typeof CandidateV2Schema>[]) {
  const state = {
    valid: false, cliVersion: "unknown", terminal: "missing" as "missing" | "invalid" | "completed" | "failed",
    exitCode: null as number | null, stories: [] as z.infer<typeof CandidateV2Schema>[],
    usage: { inputTokens: null as number | null, outputTokens: null as number | null, cachedInputTokens: null as number | null,
      cacheWriteInputTokens: null as number | null, reasoningOutputTokens: null as number | null, costUsd: null },
  };
  let thread = false, turn = false, ended = false, returned = false;
  let message: string | undefined;
  const items = new Map<string, { type: string; completed: boolean }>();
  try {
    for (const line of stdout.trimEnd().split("\n")) {
      const frame = Frame.parse(JSON.parse(line));
      if (returned) throw new Error();
      if (frame.kind === "version") {
        if (state.cliVersion !== "unknown" || thread || !/^codex-cli [0-9]+\.[0-9]+\.[0-9]+$/.test(frame.value)) throw new Error();
        state.cliVersion = frame.value;
        if (frame.value !== codexVersion) throw new Error();
      } else if (frame.kind === "stderr" || frame.kind === "refusal") {
        continue;
      } else if (frame.kind === "result") {
        returned = true;
        state.exitCode = frame.exitCode;
        if (!ended || state.terminal !== "completed" || !message || frame.final === null || frame.final !== message) throw new Error();
        state.stories = accept(JSON.parse(frame.final));
      } else {
        if (state.cliVersion !== codexVersion || ended) throw new Error();
        const event = z.object({ type: z.string() }).passthrough().parse(JSON.parse(frame.line));
        if (event.type === "thread.started") {
          if (thread || typeof event.thread_id !== "string" || !event.thread_id) throw new Error();
          thread = true;
        } else if (event.type === "turn.started") {
          if (!thread || turn) throw new Error();
          turn = true;
        } else if (["item.started", "item.updated", "item.completed"].includes(event.type)) {
          const item = z.object({ id: z.string().min(1), type: z.enum(["agent_message", "reasoning"]), text: z.string().optional() }).parse(event.item);
          const prior = items.get(item.id);
          if (!turn || prior?.completed || (prior && prior.type !== item.type) || (event.type === "item.started" && prior) || (event.type === "item.updated" && !prior)) throw new Error();
          items.set(item.id, { type: item.type, completed: event.type === "item.completed" });
          if (item.type === "agent_message" && event.type === "item.completed") {
            if (message !== undefined || typeof item.text !== "string") throw new Error();
            message = item.text;
          }
        } else if (event.type === "turn.completed") {
          if (!turn || !message || [...items.values()].some((item) => !item.completed)) throw new Error();
          const usage = Usage.parse(event.usage ?? {});
          state.usage = { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null,
            cachedInputTokens: usage.cached_input_tokens ?? null, cacheWriteInputTokens: usage.cache_write_input_tokens ?? null,
            reasoningOutputTokens: usage.reasoning_output_tokens ?? null, costUsd: null };
          state.terminal = "completed";
          ended = true;
        } else if (event.type === "turn.failed" || event.type === "error") {
          state.terminal = "failed";
          throw new Error();
        } else throw new Error();
      }
    }
    state.valid = returned && state.exitCode === 0 && state.cliVersion === codexVersion;
  } catch { if (state.terminal !== "failed" && state.terminal !== "missing") state.terminal = "invalid"; }
  return state;
}
