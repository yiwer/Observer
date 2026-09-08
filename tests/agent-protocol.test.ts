import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readCodexResult, codexVersion } from "../src/codex-protocol.ts";
import { readClaudeResult, claudeVersion } from "../src/claude-protocol.ts";
import { claudeModelRequest, claudeResponseAllowed } from "../src/claude-model-transport.ts";
import { candidateOutput } from "./helpers/model-responses.ts";
import { claudeMessageFixture } from "./helpers/claude-messages.ts";
import { ProduceRequestSchema } from "../src/contracts.ts";
import { request } from "./fixtures.ts";

test("Default Candidate readers retain the saved Codex and Claude research protocol contracts", async () => {
  const task = ProduceRequestSchema.parse(request);
  for (const provider of ["codex", "claude"] as const) {
    const sample = (await readFile(`tests/fixtures/${provider}/success.jsonl`, "utf8")).trimEnd().split("\n");
    const final = provider === "codex" ? sample.map((line) => JSON.parse(line)).find((entry) => entry.type === "item.completed" && entry.item.type === "agent_message")!.item.text : null;
    const frames = [{ kind: "version", value: provider === "codex" ? codexVersion : claudeVersion }, ...sample.map((line) => ({ kind: "event", line })), { kind: "result", exitCode: 0, final }].map((frame) => JSON.stringify(frame)).join("\n");
    const result = provider === "codex" ? readCodexResult(frames, task, "frontier-technology") : readClaudeResult(frames, task, "frontier-technology");
    assert.equal(result.valid, true);
    assert.equal(result.terminal, "completed");
    assert.deepEqual(result.stories, candidateOutput.stories);
    const mismatched = provider === "codex" ? readCodexResult(frames, { ...task, taskId: "wrong-task" }, "frontier-technology") : readClaudeResult(frames, { ...task, taskId: "wrong-task" }, "frontier-technology");
    assert.equal(mismatched.valid, false);
    assert.deepEqual(mismatched.stories, []);
  }
});

test("Default Claude data-tool mode accepts old Candidates but never silently changes to Verification", () => {
  const verification = { schemaVersion: 1, inputSha256: "a".repeat(64), provenance: "annotated-fixture", verifierVersion: "owned", assessments: [] };
  assert.equal(claudeResponseAllowed(claudeMessageFixture()), true);
  assert.equal(claudeResponseAllowed(claudeMessageFixture([{ type: "tool_use", id: "verification", name: "StructuredOutput", input: verification }])), false);
  assert.throws(() => claudeModelRequest({ messages: [{ role: "assistant", content: [{ type: "tool_use", id: "verification", name: "StructuredOutput", input: verification }] }] }, {}));
});
