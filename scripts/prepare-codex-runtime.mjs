// Explicit development setup. Downloads only a pinned official CLI dependency;
// does not start Docker, read model credentials, or invoke a model.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { join } from "node:path";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = join(root, "data", "codex-package");
const archive = join(directory, "codex-0.153.4-linux-x64.tgz");
const integrity = "x1EcwBlY3AObM1VTUHNM2AzAJQsyreGdagpF+qFiYi/Oa30VBktvvG0C6tLtCzqW6hjZNWkGZQWmeVk7MuJKWg==";
const host = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
await mkdir(directory, { recursive: true, mode: 0o700 });
try { await stat(archive); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  await exec(process.platform === "win32" ? "curl.exe" : "curl", ["-q", "--fail", "--location", "--max-time", "180",
    "--output", archive, "https://registry.npmjs.org/@openai/codex/-/codex-0.153.4-linux-x64.tgz"], { cwd: root, timeout: 185_000, windowsHide: true });
}
if (createHash("sha512").update(await readFile(archive)).digest("base64") !== integrity) throw new Error("Pinned CLI package integrity mismatch; existing archive was preserved for inspection");
const { stdout: listing } = await exec("tar", ["-tf", archive], { cwd: root, timeout: 30_000, windowsHide: true });
const allowed = new Set(["package/package.json", "package/README.md", ...["bin/codex", "bin/codex-code-mode-host", "codex-resources/bwrap", "codex-resources/zsh/bin/zsh", "codex-path/rg", "codex-package.json"].map((file) => `package/vendor/x86_64-unknown-linux-musl/${file}`)]);
const entries = listing.trim().split(/\r?\n/);
if (entries.length !== allowed.size || new Set(entries).size !== allowed.size || entries.some((file) => !allowed.has(file))) throw new Error("Unexpected CLI archive entries");
await exec("tar", ["-xf", archive, "-C", directory, "package/vendor/x86_64-unknown-linux-musl"], { cwd: root, timeout: 30_000, windowsHide: true });
await exec("docker", ["--host", host, "build", "--platform", "linux/amd64", "--network", "none", "--pull=false", "-f", "config/codex-runtime.Dockerfile",
  "-t", "observer-v1-04-codex:0.153.4", directory], { cwd: root, timeout: 180_000, maxBuffer: 1024 * 1024, windowsHide: true });
const { stdout } = await exec("docker", ["--host", host, "image", "inspect", "observer-v1-04-codex:0.153.4", "--format", "{{.Id}}"], { cwd: root, timeout: 10_000, windowsHide: true });
console.log(`Prepared Codex 0.153.4 Linux runtime: ${stdout.trim()}`);
