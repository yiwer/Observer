import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("The built collector consumes versioned Owner configuration and continuously reports pending-source gaps without enabling a demo origin", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-collector-process-"));
  const child = spawn(process.execPath, [fileURLToPath(new URL("../dist/collect-main.js", import.meta.url))], {
    env: { ...process.env, OBSERVER_SOURCE_CONFIG: fileURLToPath(new URL("../config/sources.example.v1.json", import.meta.url)), OBSERVER_COLLECTION_DATABASE_PATH: join(directory, "collection.sqlite") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, "exit"); } await rm(directory, { recursive: true, force: true }); });
  const outputs = await new Promise<Array<{ configurationId: string; added: number; coverageGaps: Array<{ reason: string }> }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("collector readiness timeout")), 10000);
    let stdout = "";
    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
      const lines = stdout.trim().split("\n");
      if (lines.length >= 2) { clearTimeout(timer); resolve(lines.map((line) => JSON.parse(line))); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`collector exited: ${code}`)); });
  });
  assert.equal(outputs[0]?.configurationId, "owner-example-v1");
  assert.equal(outputs[0]?.added, 0);
  assert.equal(outputs[0]?.coverageGaps[0]?.reason, "source-pending");
  assert.equal(outputs[1]?.coverageGaps[0]?.reason, "source-pending");
});
