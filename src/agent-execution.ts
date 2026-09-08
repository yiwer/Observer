import { z } from "zod";

export const AgentExecutionSchema = z.strictObject({
  provenance: z.enum(["protocol-fixture", "codex-cli", "claude-cli"]),
  processKind: z.enum(["protocol-fixture", "codex-cli", "claude-cli"]),
  modelTransport: z.enum(["not-used", "model-protocol-fixture", "openai-api", "anthropic-api"]),
  cliVersion: z.string().min(1).max(200), durationMs: z.number().int().nonnegative(),
  exitCode: z.number().int().nullable(), terminal: z.enum(["completed", "failed", "missing", "invalid"]),
  containerId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), cleanup: z.enum(["removed", "not-created", "unverified"]),
});
