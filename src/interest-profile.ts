import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { InterestProfileSchema, InterestSnapshotSchema, type InterestSnapshot } from "./interest-contracts.ts";

export const interestHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const interestKeyHash = (key: string) => interestHash(key.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase());

export function interestConfiguration(databasePath: string) {
  const activePath = resolve(`${databasePath}.interest.json`);
  const read = (file: string): unknown => {
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > 262144) throw new Error("invalid-interest-profile-file");
    return JSON.parse(readFileSync(file, "utf8"));
  };
  const snapshot = (): InterestSnapshot => {
    try {
      const value = InterestSnapshotSchema.parse(read(activePath));
      if (interestHash(value.profile) !== value.sha256) throw new Error("digest");
      return value;
    } catch { throw new Error("interest-profile-unavailable-or-corrupt"); }
  };
  return {
    snapshot,
    import(filePath: string): InterestSnapshot {
      if (resolve(filePath) === activePath) throw new Error("interest-profile-input-is-active-snapshot");
      let profile;
      try { profile = InterestProfileSchema.parse(read(filePath)); }
      catch { throw new Error("invalid-interest-profile-file"); }
      const value = { profile, sha256: interestHash(profile) };
      let exists = true;
      try { statSync(activePath); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        exists = false;
      }
      if (exists) {
        const active = snapshot();
        if (profile.version < active.profile.version) throw new Error("interest-profile-version-rollback");
        if (profile.version === active.profile.version) {
          if (value.sha256 !== active.sha256) throw new Error("interest-profile-version-conflict");
          return active;
        }
      }
      const temporary = `${activePath}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
      renameSync(temporary, activePath);
      return structuredClone(value);
    },
    export(filePath: string) {
      if ([activePath, resolve(databasePath)].includes(resolve(filePath))) throw new Error("interest-export-target-forbidden");
      const value = snapshot();
      writeFileSync(filePath, `${JSON.stringify(value.profile, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      return value;
    },
  };
}
