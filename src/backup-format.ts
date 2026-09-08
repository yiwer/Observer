import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { closeSync, createReadStream, createWriteStream, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

const utc = z.iso.datetime({ precision: 3, offset: false });
export const backupNames = ["reports.sqlite", "collection.sqlite", "github.sqlite", "runtime.json", "sources.json", "interest.json", "active-interest.json"] as const;
export const ManifestSchema = z.strictObject({ schemaVersion: z.literal(1), kind: z.literal("observer-off-node-snapshot"), id: z.uuid(),
  releaseId: z.string().min(1).max(200), nodeVersion: z.string(), configurationId: z.string(), boundaryAtUtc: utc,
  consistency: z.literal("app-stopped-service-lock-logical-rewrite"),
  exclusions: z.literal("secrets-devices-pairings-expiring-source-material"),
  files: z.array(z.strictObject({ name: z.enum(backupNames), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(6).max(7),
  reportIds: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/)),
});
export type BackupManifest = z.infer<typeof ManifestSchema>;
const magic = Buffer.from("OBSBK001");
export async function fileDigest(file: string) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
export async function encryptStream(chunks: AsyncIterable<Buffer>, file: string, key: Buffer) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(magic);
  async function* encoded() {
    yield Buffer.concat([magic, nonce]);
    for await (const chunk of chunks) yield cipher.update(chunk);
    yield cipher.final(); yield cipher.getAuthTag();
  }
  await pipeline(Readable.from(encoded()), createWriteStream(file, { flags: "wx", mode: 0o600 }));
}
/** Authentication completes before the caller may interpret or install plaintext. */
export async function decryptFile(file: string, plaintext: string, key: Buffer) {
  const size = statSync(file).size;
  if (size < 36) throw new Error("backup-envelope-truncated");
  const fd = openSync(file, "r"), header = Buffer.alloc(20), tag = Buffer.alloc(16);
  try {
    if (readSync(fd, header, 0, 20, 0) !== 20 || readSync(fd, tag, 0, 16, size - 16) !== 16 || !header.subarray(0, 8).equals(magic)) throw new Error("backup-envelope-invalid");
  } finally { closeSync(fd); }
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
  decipher.setAAD(magic); decipher.setAuthTag(tag);
  await pipeline(createReadStream(file, { start: 20, end: size - 17 }), decipher, createWriteStream(plaintext, { flags: "wx", mode: 0o600 }));
}
export async function encodeSnapshot(directory: string, manifest: BackupManifest, file: string, key: Buffer) {
  const body = Buffer.from(JSON.stringify(ManifestSchema.parse(manifest))), length = Buffer.alloc(4);
  if (body.length > 16 * 1024 ** 2) throw new Error("backup-manifest-too-large");
  length.writeUInt32BE(body.length);
  async function* chunks() {
    yield length; yield body;
    for (const entry of manifest.files) for await (const chunk of createReadStream(join(directory, entry.name))) yield Buffer.from(chunk);
  }
  await encryptStream(chunks(), file, key);
}
export async function decodeSnapshot(plaintext: string, destination: string, maxBytes: number): Promise<BackupManifest> {
  const fd = openSync(plaintext, "r"), size = statSync(plaintext).size;
  let manifest: BackupManifest, offset: number;
  try {
    const length = Buffer.alloc(4);
    if (readSync(fd, length, 0, 4, 0) !== 4) throw new Error("backup-manifest-missing");
    const bytes = length.readUInt32BE();
    if (bytes > 16 * 1024 ** 2 || bytes + 4 > size) throw new Error("backup-manifest-size-invalid");
    const body = Buffer.alloc(bytes);
    if (readSync(fd, body, 0, bytes, 4) !== bytes) throw new Error("backup-manifest-truncated");
    manifest = ManifestSchema.parse(JSON.parse(body.toString("utf8"))); offset = bytes + 4;
  } finally { closeSync(fd); }
  const names = manifest.files.map((entry) => entry.name);
  if (new Set(names).size !== names.length || backupNames.filter((name) => name !== "github.sqlite").some((name) => !names.includes(name)) ||
      size > maxBytes || manifest.files.reduce((sum, entry) => sum + entry.bytes, offset) !== size) throw new Error("backup-file-inventory-invalid");
  for (const entry of manifest.files) {
    if (entry.bytes === 0) throw new Error("backup-empty-file");
    const target = join(destination, entry.name);
    await pipeline(createReadStream(plaintext, { start: offset, end: offset + entry.bytes - 1 }), createWriteStream(target, { flags: "wx", mode: 0o600 }));
    if (await fileDigest(target) !== entry.sha256) throw new Error("backup-integrity-failed");
    offset += entry.bytes;
  }
  return manifest;
}
