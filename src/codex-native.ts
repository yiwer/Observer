import { spawn } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { RuntimeFailure, ContainerResult } from "./agent-container.ts";
import type { AgentRunOptions } from "./contracts.ts";
import { codexVersion } from "./codex-protocol.ts";
import { strictCodexSchema } from "./codex-output-schema.ts";

export interface NativeCodexRuntime { kind: "codex-native"; executable: string }
export const nativeCodexModel = "gpt-6-astra";
export const nativeCodexReasoningEffort = "medium";
type NativeResult = Omit<ContainerResult, "cleanup"> & { cleanup: "not-created" | "unverified" | "process-exited";
  diagnostic?: "configuration" | "authentication" | "provider-rejected" | "connection" | "schema" | "sandbox" | "cli-failure" };
let active = 0, cleanupUnverified = false;
export function nativeCodexStatus() { return { active, limit: 2, cleanupUnverified, boundary: "trusted-host-windows-job", requestAccounting: "cli-total-only" }; }

// Authentication location is inherited unchanged; Observer never opens it.
// Deliberately exclude provider keys, Owner/SMTP secrets, proxy overrides,
// NODE_OPTIONS and inherited Codex session/remote/tool configuration.
function childEnvironment(): NodeJS.ProcessEnv {
  const allowed = new Set(["path", "systemroot", "windir", "temp", "tmp", "userprofile", "home", "homedrive", "homepath", "localappdata", "appdata", "codex_home"]);
  return Object.fromEntries(Object.entries(process.env).filter(([name, value]) => allowed.has(name.toLowerCase()) && value !== undefined));
}
const WorkerResult = z.object({ version: z.string().max(200), stdout: z.string(), exitCode: z.number().int().nullable(), outputLimit: z.boolean(),
  diagnostic: z.enum(["configuration", "authentication", "provider-rejected", "connection", "schema", "sandbox", "cli-failure"]).nullable() });

export function nativeCodexArguments(model: string, schemaPath: string, finalPath: string) {
  return ["-a", "never", "-s", "read-only", "-c", 'model_provider="openai"', "-c", 'forced_login_method="chatgpt"', "-c", 'model_reasoning_effort="medium"',
    "-c", 'web_search="disabled"', "-c", "features.shell_tool=false", "-c", "features.apps=false", "-c", "features.hooks=false",
    "-c", "features.multi_agent=false", "-c", "features.js_repl=false", "-c", "features.view_image=false", "-c", "features.image_generation=false", "-c", "mcp_servers={}", "-c", "project_doc_max_bytes=0",
    "exec", "--strict-config", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--ephemeral", "--json", "--color", "never",
    "--model", model, "--output-schema", schemaPath, "--output-last-message", finalPath, "-"];
}

export async function runNativeCodex(options: {
  runtime: NativeCodexRuntime; model: string; prompt: string; schema: unknown;
  timeoutMs: number; maxBytes: number; signal?: AbortSignal; dispatchControl?: AgentRunOptions["dispatchControl"];
  evidenceExpiresAtUtc?: string;
}): Promise<NativeResult> {
  let result: NativeResult = { stdout: "", exitCode: null, containerId: null, cleanup: "not-created" };
  if (process.platform !== "win32" || !isAbsolute(options.runtime.executable) || !/\.exe$/i.test(options.runtime.executable) || active >= 2 || cleanupUnverified) return { ...result, failure: "unavailable" };
  if (options.model !== nativeCodexModel || !Number.isFinite(options.timeoutMs) || options.timeoutMs < 1 ||
    !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1024 || options.maxBytes > 8 * 1024 * 1024) return { ...result, failure: "unavailable", diagnostic: "configuration" };
  if (options.signal?.aborted) return { ...result, failure: "cancelled" };
  if (Buffer.byteLength(options.prompt) > 1024 * 1024 || Buffer.byteLength(JSON.stringify(options.schema)) > 1024 * 1024) return { ...result, failure: "input-limit" };
  const expiryMs = options.evidenceExpiresAtUtc ? Date.parse(options.evidenceExpiresAtUtc) - Date.now() : Infinity;
  if (Number.isNaN(expiryMs) || expiryMs <= 0) return { ...result, failure: "evidence-expired" };
  active++;
  let directory: string | undefined;
  try {
    const executable = await realpath(options.runtime.executable);
    if (!(await stat(executable)).isFile()) return { ...result, failure: "unavailable" };
    // An OS temporary directory keeps repository AGENTS/config out of the task.
    directory = await mkdtemp(join(await realpath(tmpdir()), "observer-native-"));
    const schemaPath = join(directory, "schema.json"), finalPath = join(directory, "final.json");
    await writeFile(schemaPath, JSON.stringify(strictCodexSchema(options.schema)), { flag: "wx", mode: 0o600 });
    const run = async (): Promise<NativeResult> => {
      const signal = options.signal ?? new AbortController().signal;
      if (signal.aborted) return { ...result, failure: "cancelled" };
      const remainingEvidenceMs = options.evidenceExpiresAtUtc ? Date.parse(options.evidenceExpiresAtUtc) - Date.now() : Infinity;
      if (remainingEvidenceMs <= 0) return { ...result, failure: "evidence-expired" };
      const timeoutMs = Math.max(1, Math.floor(Math.min(options.timeoutMs, remainingEvidenceMs, 300000)));
      const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      const worker = fileURLToPath(new URL("./codex-native-worker.ps1", import.meta.url));
      const observed = await new Promise<{ text: string; failure?: RuntimeFailure; exited: boolean }>((done) => {
        const child = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", worker], { cwd: directory, env: childEnvironment(), shell: false, windowsHide: true });
        let text = "", bytes = 0, failure: RuntimeFailure | undefined, closed = false;
        const stop = (reason: RuntimeFailure) => { failure ??= reason; if (child.exitCode === null && child.signalCode === null) child.kill(); };
        const abort = () => stop("cancelled");
        signal.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(() => stop(remainingEvidenceMs <= Math.min(options.timeoutMs, 300000) ? "evidence-expired" : "timeout"), timeoutMs);
        // Reserve a bounded cleanup interval even if a platform handle fails to close.
        const closing = setTimeout(() => { if (!closed) { stop("cleanup-failed"); done({ text: "", failure: "cleanup-failed", exited: false }); } }, timeoutMs + 1000);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (data: string) => { bytes += Buffer.byteLength(data); if (bytes > options.maxBytes * 8 + 16384) stop("output-limit"); else text += data; });
        child.stderr.on("data", (data: Buffer) => { bytes += data.length; if (bytes > options.maxBytes * 8 + 16384) stop("output-limit"); });
        child.stdin.on("error", () => {});
        child.on("error", () => { failure ??= "unavailable"; });
        child.on("close", () => {
          closed = true; clearTimeout(timer); clearTimeout(closing); signal.removeEventListener("abort", abort);
          done({ text, ...(failure ? { failure } : {}), exited: true });
        });
        child.stdin.end(JSON.stringify({ program: executable, args: nativeCodexArguments(options.model, schemaPath, finalPath), prompt: options.prompt,
          timeoutMs, maxBytes: options.maxBytes }) + "\n");
      });
      result.cleanup = observed.exited ? "process-exited" : "unverified";
      if (observed.failure) return { ...result, failure: observed.failure };
      let receipt: z.infer<typeof WorkerResult>;
      try { receipt = WorkerResult.parse(JSON.parse(observed.text)); }
      catch { return { ...result, failure: "unavailable" }; }
      result.exitCode = receipt.exitCode;
      if (receipt.diagnostic) result.diagnostic = receipt.diagnostic;
      if (receipt.outputLimit) return { ...result, failure: "output-limit" };
      let final: string | null = null;
      try {
        const info = await stat(finalPath);
        if (info.size > options.maxBytes) return { ...result, failure: "output-limit" };
        final = (await readFile(finalPath, "utf8")).trim();
      } catch { /* Missing output is a failed run, never a generated result. */ }
      // These are Observer adapter frames around actual --version and raw JSONL,
      // not invented native CLI events. Reuse the existing strict protocol reader.
      result.stdout = [JSON.stringify({ kind: "version", value: receipt.version }),
        ...receipt.stdout.trimEnd().split(/\r?\n/).filter(Boolean).map((line) => JSON.stringify({ kind: "event", line })),
        ...(receipt.exitCode === null ? [] : [JSON.stringify({ kind: "result", exitCode: receipt.exitCode, final })])].join("\n");
      if (receipt.version !== codexVersion) return result;
      return result;
    };
    // Routing rechecks evidence/Owner authorization at process dispatch. It does
    // not fabricate per-request broker admission or usage receipts for this CLI.
    result = options.dispatchControl?.nativeProcess ? await options.dispatchControl.nativeProcess(run, options.signal ?? new AbortController().signal) : await run();
    return result;
  } catch { result.failure = "unavailable"; return result; }
  finally {
    if (directory) {
      // Exact, newly created directory only; never sweep older tasks or credentials.
      try { await rm(resolve(directory), { recursive: true }); }
      catch { result.cleanup = "unverified"; result.failure = "cleanup-failed"; }
    }
    if (result.cleanup === "unverified") cleanupUnverified = true;
    active--;
  }
}
