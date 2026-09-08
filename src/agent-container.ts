import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import { modelResponseHasNoTools, type CodexModelTransport } from "./codex-model-transport.ts";
import { claudeModelRequest, claudeResponseAllowed, type ClaudeModelTransport } from "./claude-model-transport.ts";

export interface AgentRuntime {
  kind: "protocol-fixture" | "codex-cli" | "claude-cli";
  image: string;
  program?: string;
  scenario?: string;
}
export interface ContainerResult {
  stdout: string;
  exitCode: number | null;
  containerId: string | null;
  cleanup: "removed" | "not-created" | "unverified";
  failure?: RuntimeFailure;
}
export type RuntimeFailure = "timeout" | "cancelled" | "output-limit" | "input-limit" | "unavailable" | "cleanup-failed" | "policy-violation" | "evidence-expired";
export class ModelBoundaryError extends Error {
  readonly category: "evidence-expired";
  constructor(category: "evidence-expired") { super(category); this.category = category; }
}
let activeContainers = 0;
let cleanupUnverified = false;
let nodeAdmission = "ready";
export function agentContainerStatus() {
  const limit = Number(process.env.OBSERVER_AGENT_CONCURRENCY ?? "2");
  if (!Number.isInteger(limit) || limit < 1 || limit > 4) throw new Error("invalid-agent-concurrency");
  return { active: activeContainers, limit, cleanupUnverified, nodeAdmission };
}
export async function prepareAgentNode(taskRoot: string, signal: AbortSignal): Promise<string> {
  nodeAdmission = "checking";
  nodeAdmission = await inspectAgentNode(taskRoot, signal);
  return nodeAdmission;
}
async function inspectAgentNode(taskRoot: string, signal: AbortSignal): Promise<string> {
  const node = process.env.OBSERVER_NODE_ID;
  if (!node) return "ready";
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(node)) return "invalid-node-id";
  try {
    await mkdir(taskRoot, { recursive: true, mode: 0o700 });
    const deadline = performance.now() + 330000;
    while (!signal.aborted && performance.now() < deadline) {
      const result = await docker(["ps", "--quiet", "--no-trunc", "--filter", `label=observer.node=${node}`], taskRoot, { signal });
      if (result.failure || result.code !== 0) return signal.aborted ? "cancelled" : "daemon-unavailable";
      if (!result.text.trim()) return "ready";
      if (!result.text.trim().split(/\s+/).every((id) => /^[a-f0-9]{64}$/.test(id))) return "daemon-unavailable";
      // Previous app processes cannot broker more model calls. Let their own
      // independent deadline stop them before admitting this instance's work.
      await new Promise<void>((done) => setTimeout(done, 1000));
    }
    return signal.aborted ? "cancelled" : "orphan-agents-running";
  } catch { return "daemon-unavailable"; }
}
interface CommandResult { text: string; code: number | null; failure?: RuntimeFailure; }

function docker(args: string[], cwd: string, options: { signal?: AbortSignal; timeoutMs?: number; input?: string; maxBytes?: number;
  transport?: CodexModelTransport | ClaudeModelTransport; provider?: "codex" | "claude"; model?: string; schema?: unknown; outputMode?: "candidate" | "verification"; maxModelRequests?: number } = {}): Promise<CommandResult> {
  return new Promise((resolveResult) => {
    if (options.signal?.aborted) { resolveResult({ text: "", code: null, failure: "cancelled" }); return; }
    const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP"].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]!]]));
    env.DOCKER_CONFIG = cwd;
    const host = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
    const child = spawn("docker", ["--host", host, ...args], { cwd, windowsHide: true, shell: false, env });
    let text = "", bytes = 0, failure: RuntimeFailure | undefined;
    const decoder = new StringDecoder("utf8");
    const modelAbort = new AbortController();
    let pending = "", modelRequests = 0;
    const requestIds = new Set<string>();
    const stop = (reason: RuntimeFailure) => {
      failure ??= reason;
      modelAbort.abort();
      // Only our live Docker client handle; the task tree is removed below by container identity.
      if (child.exitCode === null && child.signalCode === null) child.kill();
    };
    const abort = () => stop("cancelled");
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => stop("timeout"), options.timeoutMs ?? 10_000);
    child.stdout.on("data", (data: Buffer) => {
      bytes += data.length;
      if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) { stop("output-limit"); return; }
      pending += decoder.write(data);
      for (;;) {
        const newline = pending.indexOf("\n");
        if (newline < 0) break;
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        let frame: Record<string, unknown>;
        try { frame = JSON.parse(line); } catch { text += line + "\n"; continue; }
        if (frame.kind === "stderr") {
          if (typeof frame.bytes !== "number" || !Number.isSafeInteger(frame.bytes) || frame.bytes < 0) { stop("output-limit"); continue; }
          bytes += frame.bytes;
          if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) { stop("output-limit"); continue; }
        }
        if (frame.kind !== "model-request") { text += line + "\n"; continue; }
        const id = frame.id;
        const body = frame.body as Record<string, unknown>;
        if (!options.transport || typeof id !== "string" || !/^[0-9]{1,4}$/.test(id) || requestIds.has(id) ||
            !body || typeof body !== "object" || body.model !== options.model || ++modelRequests > (options.maxModelRequests ?? 4)) {
          stop("policy-violation"); continue;
        }
        requestIds.add(id);
        // Override provider-requested tool/storage settings at the trusted boundary.
        let modelBody: Record<string, unknown>;
        try {
          modelBody = options.provider === "claude" ? claudeModelRequest(body, options.schema, options.outputMode) :
            { ...body, model: options.model, tools: [], tool_choice: "none", store: false, stream: true, background: false };
        } catch { stop("policy-violation"); continue; }
        void Promise.resolve().then(() => options.transport!.respond(modelBody, modelAbort.signal)).then((response) => {
          if (modelAbort.signal.aborted) return;
          if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599 || Buffer.byteLength(response.body) > 2 * 1024 * 1024) { stop("output-limit"); return; }
          if (response.status === 200 && !(options.provider === "claude" ? claudeResponseAllowed(response.body, options.outputMode) : modelResponseHasNoTools(response.body))) { stop("policy-violation"); return; }
          child.stdin.write(JSON.stringify({ id, status: response.status, body: response.body }) + "\n");
        }).catch((error: unknown) => { if (!modelAbort.signal.aborted) stop(error instanceof ModelBoundaryError ? error.category : "unavailable"); });
      }
    });
    child.stderr.on("data", (data: Buffer) => { bytes += data.length; if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) stop("output-limit"); });
    child.stdin.on("error", () => {});
    if (options.transport) child.stdin.write((options.input ?? "") + "\n");
    else child.stdin.end(options.input ?? "");
    child.on("error", () => { failure ??= "unavailable"; });
    child.on("close", (code) => {
      clearTimeout(timer); options.signal?.removeEventListener("abort", abort);
      modelAbort.abort(); child.stdin.end();
      text += pending + decoder.end();
      resolveResult({ text, code, ...(failure ? { failure } : {}) });
    });
  });
}

// Docker is the external process boundary. Every invocation creates a unique
// container; its immutable ID owns the complete task process tree.
type ContainerOptions = {
  provider: "codex" | "claude";
  taskRoot: string; runtime: AgentRuntime; args: string[]; prompt: string; schema: unknown;
  taskId: string;
  signal?: AbortSignal; timeoutMs: number; maxBytes: number;
  transport?: CodexModelTransport | ClaudeModelTransport; model: string; maxModelRequests: number; outputMode?: "candidate" | "verification";
};
export async function runAgentContainer(options: ContainerOptions): Promise<ContainerResult> {
  // Includes daily research and correction runners in this one app process.
  // Fail admission before creating an unbounded second workload.
  if (nodeAdmission !== "ready" || cleanupUnverified || activeContainers >= agentContainerStatus().limit) return { stdout: "", exitCode: null, containerId: null, cleanup: "not-created", failure: "unavailable" };
  activeContainers++;
  try {
    const result = await executeAgentContainer(options);
    if (result.cleanup === "unverified") cleanupUnverified = true;
    return result;
  } finally { activeContainers--; }
}
async function executeAgentContainer(options: ContainerOptions): Promise<ContainerResult> {
  const result: ContainerResult = { stdout: "", exitCode: null, containerId: null, cleanup: "not-created" };
  if (Buffer.byteLength(options.prompt) > 1024 * 1024) return { ...result, failure: "input-limit" };
  if (!/^sha256:[a-f0-9]{64}$/.test(options.runtime.image) || !isAbsolute(options.taskRoot)) return { ...result, failure: "unavailable" };
  if (options.signal?.aborted) return { ...result, failure: "cancelled" };
  let directory: string;
  try {
    await mkdir(options.taskRoot, { recursive: true, mode: 0o700 });
    directory = await mkdtemp(join(await realpath(options.taskRoot), "run-"));
  } catch { return { ...result, failure: "unavailable" }; }
  const name = `observer-${options.provider}-${randomUUID()}`;
  const deadline = performance.now() + options.timeoutMs;
  let createdAt: string | undefined;
  let creationAttempted = false;
  const inspect = async (id: string) => {
    const response = await docker(["inspect", id], directory);
    if (response.code !== 0 || response.failure) return undefined;
    try { return JSON.parse(response.text)[0] as { Id: string; Name: string; Created: string; Image: string; Config: { Labels: Record<string, string> } }; }
    catch { return undefined; }
  };
  const belongsToTask = (identity: Awaited<ReturnType<typeof inspect>>) => identity && /^[a-f0-9]{64}$/.test(identity.Id) &&
    identity.Name === `/${name}` && identity.Config?.Labels?.["observer.task"] === name && identity.Image === options.runtime.image && typeof identity.Created === "string" &&
    (!result.containerId || identity.Id === result.containerId) && (!createdAt || identity.Created === createdAt);
  try {
    if (options.runtime.kind !== "protocol-fixture" && options.runtime.kind !== `${options.provider}-cli`) throw new Error("unavailable");
    const program = options.runtime.kind === "protocol-fixture" ? ["python3", "/observer-program.py"] : [options.provider === "claude" ? "/opt/claude" : "/opt/codex/bin/codex"];
    const worker = fileURLToPath(new URL("./agent-worker.py", import.meta.url));
    // Send only trusted, image-shipped program text as argv. No daemon-host bind
    // path is needed when this application itself runs inside a container.
    const workerProgram = await readFile(worker, "utf8");
    if (Buffer.byteLength(workerProgram) > 65536) throw new Error("worker-too-large");
    const node = process.env.OBSERVER_NODE_ID;
    if (node && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(node)) throw new Error("invalid-node-id");
    const args = ["create", "--interactive", "--pull=never", "--name", name, "--label", `observer.task=${name}`,
      "--label", `observer.request=${createHash("sha256").update(options.taskId).digest("hex")}`,
      "--log-driver", "none",
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
      "--pids-limit", "32", "--memory", options.provider === "claude" ? "512m" : "256m", "--cpus", "1", "--user", "65534:65534",
      "--tmpfs", "/run/observer:rw,noexec,nosuid,size=16777216,mode=700,uid=65534,gid=65534",
      "--workdir", "/task", "--entrypoint", "/usr/bin/env"];
    if (node) args.push("--label", `observer.node=${node}`);
    if (options.runtime.kind === "protocol-fixture") {
      if (!options.runtime.program || !isAbsolute(options.runtime.program)) throw new Error("unavailable");
      args.push("--mount", `type=bind,source=${await realpath(options.runtime.program)},target=/observer-program.py,readonly`);
    }
    args.push(options.runtime.image, "-i", "PATH=/usr/local/bin:/usr/bin:/bin", "LANG=C.UTF-8", "HOME=/run/observer",
      "CODEX_HOME=/run/observer/codex", "TOKIO_WORKER_THREADS=2", "RAYON_NUM_THREADS=2",
      `OBSERVER_TASK_TIMEOUT_SECONDS=${Math.max(1, Math.ceil(options.timeoutMs / 1000))}`,
      `OBSERVER_SCENARIO=${options.runtime.scenario ?? "success"}`, "python3", "-u", "-c", workerProgram);
    creationAttempted = true;
    const created = await docker(args, directory, { timeoutMs: Math.max(1, deadline - performance.now()), ...(options.signal ? { signal: options.signal } : {}) });
    if (created.failure) { result.failure = created.failure; return result; }
    if (created.code !== 0 || !/^[a-f0-9]{64}\s*$/.test(created.text)) throw new Error();
    result.containerId = created.text.trim();
    const identity = await inspect(result.containerId);
    if (!belongsToTask(identity)) throw new Error();
    createdAt = identity!.Created;
    const run = await docker(["start", "--attach", "--interactive", result.containerId], directory, {
      timeoutMs: Math.max(1, deadline - performance.now()), maxBytes: options.maxBytes,
      ...(options.signal ? { signal: options.signal } : {}),
      input: JSON.stringify({ provider: options.provider, program, args: options.args, prompt: options.prompt, schema: options.schema,
        model: options.model, modelTransport: Boolean(options.transport) }),
      ...(options.transport ? { transport: options.transport, provider: options.provider, model: options.model, schema: options.schema, maxModelRequests: options.maxModelRequests, ...(options.outputMode ? { outputMode: options.outputMode } : {}) } : {}),
    });
    result.stdout = run.text; result.exitCode = run.code;
    if (run.failure) result.failure = run.failure;
  } catch { result.failure ??= "unavailable";
  } finally {
    if (creationAttempted) {
      const identity = await inspect(result.containerId ?? name);
      if (belongsToTask(identity)) {
        result.containerId = identity!.Id;
        const removed = await docker(["rm", "--force", identity!.Id], directory);
        const remaining = await docker(["ps", "--all", "--quiet", "--no-trunc", "--filter", `id=${identity!.Id}`], directory);
        if (removed.code === 0 && !removed.failure && remaining.code === 0 && !remaining.failure && remaining.text.trim() === "") result.cleanup = "removed";
        else { result.cleanup = "unverified"; result.failure = "cleanup-failed"; }
      } else {
        const remaining = await docker(["ps", "--all", "--quiet", "--filter", `label=observer.task=${name}`], directory);
        if (remaining.code !== 0 || remaining.failure || remaining.text.trim()) { result.cleanup = "unverified"; result.failure = "cleanup-failed"; }
      }
    }
    // This mkdtemp child is never mounted and contains no Evidence or credential.
    try { await rm(directory, { recursive: true, force: true }); }
    catch { result.failure = "cleanup-failed"; result.cleanup = "unverified"; }
  }
  return result;
}
