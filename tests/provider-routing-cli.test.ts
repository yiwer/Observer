import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { AgentResultSchema, ProduceRequestSchema } from "../src/contracts.ts";
import { createCodexRunner } from "../src/codex-runner.ts";
import { createClaudeRunner } from "../src/claude-runner.ts";
import { ModelBoundaryError } from "../src/agent-container.ts";
import { request } from "./fixtures.ts";

test("Both fixed CLIs obey trusted host dispatch refusal before any external transport and confirm cleanup", async () => {
  for (const provider of ["codex", "claude"] as const) {
    const taskRoot = await mkdtemp(join(process.cwd(), "data", `v1-14-cli-${provider}-`));
    let dispatched = 0, refused = 0;
    const transport = { provenance: "model-protocol-fixture" as const, respond: async () => { dispatched++; throw new Error("Owned transport must not execute"); } };
    const runner = provider === "codex" ? createCodexRunner({ taskRoot, edition: "frontier-technology", model: "gpt-5.6-sol", timeoutMs: 25000,
      runtime: { kind: "codex-cli", image: "sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024" }, transport }) :
      createClaudeRunner({ taskRoot, edition: "frontier-technology", model: "claude-sonnet-4-6", timeoutMs: 25000,
        runtime: { kind: "claude-cli", image: "sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269" }, transport });
    const result = AgentResultSchema.parse(await runner.run(ProduceRequestSchema.parse(request), { dispatchControl: {
      async dispatch() { refused++; throw new ModelBoundaryError("evidence-expired"); },
    } }));
    console.log(JSON.stringify({ provider, execution: result.execution, status: result.status, dispatched, refused }));
    assert.equal(dispatched, 0);
    assert.equal(refused, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.failure.category, "evidence-expired");
    assert.equal(result.execution?.cleanup, "removed");
    assert.match(result.execution?.containerId ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.execution?.cliVersion, provider === "codex" ? "codex-cli 0.153.4" : "2.1.252 (Claude Code)");
  }
});
