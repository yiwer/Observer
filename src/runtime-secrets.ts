import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

// Secret values are never included in error messages, runtime configuration or status.
// A configured file is authoritative: unreadable files never fall back to an old env key.
export function runtimeSecret(name: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  if (!file) return process.env[name];
  try {
    if (!isAbsolute(file)) throw new Error();
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > 16384 || (process.platform !== "win32" && (stat.mode & 0o007) !== 0)) throw new Error();
    const value = readFileSync(file, "utf8").replace(/\r?\n$/, "");
    if (!value || /[\r\n\0]/.test(value)) throw new Error();
    return value;
  } catch { throw new Error("runtime-secret-unavailable"); }
}
