import { z } from "zod";
import type { ProduceRequest } from "./contracts.ts";
import { CandidateOutput } from "./agent-candidate.ts";
import { VerificationSchema, type VerificationInput, type Verification } from "./gate-contracts.ts";

export const claudeVersion = "2.1.252 (Claude Code)";
const Frame = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("version"), value: z.string() }),
  z.strictObject({ kind: z.literal("event"), line: z.string() }),
  z.strictObject({ kind: z.literal("stderr"), bytes: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal("refusal"), reason: z.string() }),
  z.strictObject({ kind: z.literal("result"), exitCode: z.number().int(), final: z.null() }),
]);
const Result = z.object({ type: z.literal("result"), session_id: z.string(), subtype: z.string(), is_error: z.boolean(),
  num_turns: z.number().int().positive().max(4), stop_reason: z.string().nullable(), terminal_reason: z.string(),
  permission_denials: z.array(z.unknown()), api_error_status: z.number().nullable().optional(), errors: z.array(z.unknown()).optional(),
  structured_output: z.unknown().optional() });
export function readClaudeResult(stdout: string, task: ProduceRequest, edition: string) {
  const result = readClaudeProtocol(stdout, CandidateOutput, (output) => {
    if (output.taskId !== task.taskId || output.evidenceBundleId !== task.evidenceBundle.id || output.configurationId !== task.configurationId || output.stories.some((story) => story.edition !== edition)) throw new Error();
  });
  return { valid: result.valid, cliVersion: result.cliVersion, terminal: result.terminal, stories: result.output?.stories ?? [] };
}

export function readClaudeVerification(stdout: string, input: VerificationInput) {
  const result = readClaudeProtocol(stdout, VerificationSchema, (output) => { if (output.inputSha256 !== input.inputSha256) throw new Error(); });
  return { valid: result.valid, cliVersion: result.cliVersion, terminal: result.terminal, verification: result.output as Verification | null };
}

function readClaudeProtocol<T>(stdout: string, schema: z.ZodType<T>, accept: (value: T) => void) {
  const state = { valid: false, cliVersion: "unknown", terminal: "missing" as "missing" | "invalid" | "completed" | "failed",
    output: null as T | null };
  let result: z.infer<typeof Result> | undefined;
  let returned = false;
  let session: string | undefined;
  const tools = new Map<string, { output: T; completed: boolean }>();
  try {
    for (const line of stdout.trimEnd().split("\n")) {
      const frame = Frame.parse(JSON.parse(line));
      if (returned) throw new Error();
      if (frame.kind === "version") {
        if (state.cliVersion !== "unknown" || session) throw new Error();
        state.cliVersion = frame.value;
      } else if (frame.kind === "event") {
        if (state.cliVersion !== claudeVersion) throw new Error();
        const event = z.object({ type: z.string(), session_id: z.string().min(1) }).passthrough().parse(JSON.parse(frame.line));
        if (session && event.session_id !== session) throw new Error();
        if (event.type === "system" && event.subtype === "init") {
          if (session || result) throw new Error();
          z.object({ cwd: z.literal("/task"), tools: z.tuple([z.literal("StructuredOutput")]), mcp_servers: z.tuple([]),
            model: z.literal("claude-sonnet-4-6"), permissionMode: z.literal("dontAsk"), claude_code_version: z.literal("2.1.252"),
            skills: z.tuple([]), plugins: z.tuple([]), slash_commands: z.tuple([]) }).parse(event);
          session = event.session_id;
        } else if (!session) throw new Error();
        else if (event.type === "system" && event.subtype === "prompt_suggestion") {
          // Documented trailing informational event, never an alternative result.
          z.object({ suggestion: z.string() }).parse(event);
        } else if (result) throw new Error();
        else if (event.type === "result") {
          if (result) throw new Error();
          result = Result.parse(event);
          if (result.subtype !== "success" || result.is_error || result.terminal_reason !== "completed" ||
              !["tool_use", "end_turn"].includes(result.stop_reason ?? "") || result.permission_denials.length || result.errors?.length || result.api_error_status != null) {
            state.terminal = "failed";
          }
        } else if (event.type === "assistant") {
          const message = z.object({ role: z.literal("assistant"), model: z.literal("claude-sonnet-4-6"), content: z.array(z.object({ type: z.string() }).passthrough()) }).parse(event.message);
          for (const block of message.content) {
            if (block.type === "tool_use") {
              const tool = z.object({ id: z.string().min(1), name: z.literal("StructuredOutput"), input: schema }).parse(block);
              if (tools.has(tool.id)) throw new Error();
              tools.set(tool.id, { output: tool.input, completed: false });
            } else if (!["text", "thinking", "redacted_thinking"].includes(block.type)) throw new Error();
          }
        } else if (event.type === "user") {
          const message = z.object({ role: z.literal("user"), content: z.array(z.object({ type: z.string() }).passthrough()) }).parse(event.message);
          for (const block of message.content) {
            if (block.type === "tool_result") {
              const tool = z.object({ tool_use_id: z.string(), is_error: z.literal(false).optional() }).parse(block);
              const pending = tools.get(tool.tool_use_id);
              if (!pending || pending.completed) throw new Error();
              pending.completed = true;
            } else if (block.type !== "text" || event.isSynthetic !== true) throw new Error();
          }
        } else if (event.type === "system" && event.subtype === "api_retry") {
          // Retries remain bounded by the host send count and wall-clock deadline.
        } else throw new Error();
      } else if (frame.kind === "result") {
        returned = true;
        if (frame.exitCode !== 0 || !result || state.terminal === "failed") throw new Error();
        const output = schema.parse(result.structured_output);
        const completed = [...tools.values()];
        if (!completed.length || completed.some((tool) => !tool.completed) || JSON.stringify(completed.at(-1)!.output) !== JSON.stringify(output)) throw new Error();
        accept(output);
        state.output = output;
        state.terminal = "completed";
      }
    }
    state.valid = returned && state.terminal === "completed" && state.cliVersion === claudeVersion;
  } catch { if (state.terminal !== "failed") state.terminal = "invalid"; }
  return state;
}
