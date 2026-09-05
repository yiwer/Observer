// Explicit local dependency preparation; never invokes a model or reads authentication.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { join } from "node:path";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = join(root, "data", "claude-package");
const keyring = join(directory, "verification-keyring");
const version = "2.1.252";
const fingerprint = "31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE";
const checksum = "a715a45105e593fc9808d035d77781f88480b9897975a9df41837f0c591bd4b3";
const host = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
await mkdir(keyring, { recursive: true, mode: 0o700 });
const gpg = process.env.OBSERVER_GPG_PATH ?? "gpg";
for (const [filename, url] of [
  ["claude-code.asc", "https://downloads.claude.ai/keys/claude-code.asc"],
  ["manifest.json", `https://downloads.claude.ai/claude-code-releases/${version}/manifest.json`],
  ["manifest.json.sig", `https://downloads.claude.ai/claude-code-releases/${version}/manifest.json.sig`],
  ["claude", `https://downloads.claude.ai/claude-code-releases/${version}/linux-x64/claude`],
]) {
  const target = join(directory, filename);
  try { await stat(target); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await exec(process.platform === "win32" ? "curl.exe" : "curl", ["-q", "--fail", "--location", "--max-time", "300", "--output", target, url],
      { cwd: root, timeout: 305_000, windowsHide: true });
  }
}
const gpgArgs = ["--no-options", "--homedir", "verification-keyring", "--batch", "--no-auto-key-retrieve"];
await exec(gpg, [...gpgArgs, "--import", "claude-code.asc"], { cwd: directory, windowsHide: true });
const signature = await exec(gpg, [...gpgArgs, "--status-fd", "1", "--verify", "manifest.json.sig", "manifest.json"], { cwd: directory, windowsHide: true });
if (!signature.stdout.split(/\r?\n/).some((line) => line.startsWith(`[GNUPG:] VALIDSIG ${fingerprint} `))) throw new Error("Release signature fingerprint mismatch");
const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
if (manifest.version !== version || manifest.platforms?.["linux-x64"]?.checksum !== checksum ||
    createHash("sha256").update(await readFile(join(directory, "claude"))).digest("hex") !== checksum) throw new Error("Pinned Claude binary integrity mismatch; files preserved for inspection");
await exec("docker", ["--host", host, "build", "--platform", "linux/amd64", "--network", "none", "--pull=false", "-f", "config/claude-runtime.Dockerfile",
  "-t", `observer-v1-05-claude:${version}`, directory], { cwd: root, timeout: 180_000, maxBuffer: 1024 * 1024, windowsHide: true });
const { stdout } = await exec("docker", ["--host", host, "image", "inspect", `observer-v1-05-claude:${version}`, "--format", "{{.Id}}"], { timeout: 10_000, windowsHide: true });
console.log(`Verified ${fingerprint}; Claude ${version} sha256:${checksum}; runtime ${stdout.trim()}`);
