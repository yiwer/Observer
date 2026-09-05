import assert from "node:assert/strict";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { ownerToken } from "./fixtures.ts";

async function startFixtureProcess(t: TestContext, databasePath: string, produce: boolean) {
  const child = fork(new URL("./helpers/fixture-process.ts", import.meta.url), [databasePath, ...(produce ? ["produce"] : [])], {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, "exit"); } });
  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Fixture process readiness timeout")); }, 10_000);
    child.once("message", (message) => {
      clearTimeout(timeout);
      if (typeof message !== "object" || message === null || !("port" in message) || typeof message.port !== "number") {
        reject(new Error("Invalid fixture process address"));
      } else resolve(message.port);
    });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", () => { clearTimeout(timeout); reject(new Error(`Fixture process exited: ${stderr}`)); });
  });
  return { child, baseUrl: `http://127.0.0.1:${port}` };
}

async function stop(child: ChildProcess) {
  const exited = once(child, "exit");
  child.send("stop");
  const [code] = await exited;
  assert.equal(code, 0);
}

test("A published private Brief remains byte-identical after the writer process exits and a new reader starts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-process-"));
  const databasePath = join(directory, "archive.sqlite");
  const first = await startFixtureProcess(t, databasePath, true);
  const route = "/v1/reports/2026-09-05-v1";
  const headers = { Authorization: `Bearer ${ownerToken}` };
  const unauthorized = await fetch(first.baseUrl + route);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await unauthorized.text(), /12 个观测点|evidence-1/);
  const published = await fetch(first.baseUrl + route, { headers });
  assert.equal(published.status, 200);
  const original = await published.json();
  const markdown = await fetch(first.baseUrl + route + "/markdown", { headers });
  assert.equal(await markdown.text(), original.canonicalMarkdown);
  await stop(first.child);
  const restarted = await startFixtureProcess(t, databasePath, false);
  const persisted = await fetch(restarted.baseUrl + route, { headers });
  assert.equal(persisted.status, 200);
  assert.deepEqual(await persisted.json(), original);
  await stop(restarted.child);
  await rm(directory, { recursive: true, force: true });
});

test("The built production entry cannot serve fixture research or expose a publication route, even with fixture environment flags", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-production-"));
  const databasePath = join(directory, "archive.sqlite");
  const fixtureProcess = await startFixtureProcess(t, databasePath, true);
  await stop(fixtureProcess.child);
  const production = spawn(process.execPath, [fileURLToPath(new URL("../dist/main.js", import.meta.url))], {
    env: {
      ...process.env, OBSERVER_DATABASE_PATH: databasePath, OBSERVER_OWNER_TOKEN: ownerToken,
      OBSERVER_PORT: "0", NODE_ENV: "test", OBSERVER_MODE: "test-fixture",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (production.exitCode === null && production.signalCode === null) { production.kill(); await once(production, "exit"); }
    await rm(directory, { recursive: true, force: true });
  });
  const baseUrl = await new Promise<string>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => { production.kill(); reject(new Error("Production startup timeout")); }, 10_000);
    production.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const address = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (address) { clearTimeout(timeout); resolve(address); }
    });
    production.stderr.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
    production.once("error", (error) => { clearTimeout(timeout); reject(error); });
    production.once("exit", () => { clearTimeout(timeout); reject(new Error(`Production entry exited: ${errors}`)); });
  });
  const headers = { Authorization: `Bearer ${ownerToken}` };
  for (const suffix of ["", "/markdown"]) {
    const response = await fetch(baseUrl + "/v1/reports/2026-09-05-v1" + suffix, { headers });
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /12 个观测点|evidence-1/);
  }
  const publication = await fetch(baseUrl + "/v1/reports", { method: "POST", headers });
  assert.equal(publication.status, 405);
});
