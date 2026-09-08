import { readFileSync, readlinkSync } from "node:fs";

// Linux PID numbers repeat across container restarts. Boot, namespace and start
// ticks bind a scheduled claim to the actual process, without a host PID mount.
export function processIdentity(pid: number): string | null {
  if (process.platform !== "linux") return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const start = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    if (!start || !/^\d+$/.test(start)) return null;
    return `${readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()}:${readlinkSync(`/proc/${pid}/ns/pid`)}:${start}`;
  } catch { return null; }
}
