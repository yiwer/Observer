import { z } from "zod";

export const AgentExecutionSchema = z.strictObject({
  provenance: z.enum(["protocol-fixture", "codex-cli", "claude-cli", "codex-native"]),
  processKind: z.enum(["protocol-fixture", "codex-cli", "claude-cli", "codex-native"]),
  modelTransport: z.enum(["not-used", "model-protocol-fixture", "openai-api", "anthropic-api", "codex-saved-login"]),
  cliVersion: z.string().min(1).max(200), durationMs: z.number().int().nonnegative(),
  exitCode: z.number().int().nullable(), terminal: z.enum(["completed", "failed", "missing", "invalid"]),
  containerId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), cleanup: z.enum(["removed", "not-created", "unverified", "process-exited"]),
  authSource: z.literal("cli-managed-chatgpt-login").optional(),
  isolation: z.literal("trusted-host-windows-job").optional(),
  requestControl: z.literal("process-only").optional(),
  reasoningEffort: z.literal("medium").optional(),
  diagnostic: z.enum(["configuration", "authentication", "provider-rejected", "connection", "schema", "sandbox", "cli-failure"]).optional(),
});

type Execution = z.infer<typeof AgentExecutionSchema>;
// A failed launch still has a real transport identity. Completion additionally
// needs observed process/container cleanup; native never borrows container proof.
export function liveExecutionMatches(execution: Execution | undefined, provider: string, succeeded = false): boolean {
  if (!execution) return false;
  if (provider === "codex" && execution.provenance === "codex-native") {
    return execution.processKind === "codex-native" && execution.modelTransport === "codex-saved-login" &&
      execution.authSource === "cli-managed-chatgpt-login" && execution.isolation === "trusted-host-windows-job" &&
      execution.requestControl === "process-only" && execution.containerId === null &&
      (!succeeded || execution.cleanup === "process-exited" && execution.exitCode === 0 && execution.terminal === "completed");
  }
  return execution.provenance === `${provider}-cli` && execution.processKind === `${provider}-cli` &&
    (execution.modelTransport === (provider === "codex" ? "openai-api" : "anthropic-api") || !succeeded && execution.modelTransport === "not-used") &&
    (!succeeded || execution.cleanup === "removed" && !!execution.containerId && execution.exitCode === 0 && execution.terminal === "completed");
}
