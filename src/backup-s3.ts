import { createReadStream, createWriteStream, statSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { S3Client, GetPublicAccessBlockCommand, GetBucketPolicyStatusCommand, GetBucketVersioningCommand,
  GetObjectLockConfigurationCommand, GetBucketReplicationCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

export const ObjectStoreSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }), region: z.string().regex(/^[a-z0-9-]{1,64}$/),
  bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  prefix: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,160}$/),
  expectedBucketOwner: z.string().regex(/^\d{12}$/), credentialsPath: z.string().min(1),
});
export const ObjectCredentialsSchema = z.strictObject({ accessKeyId: z.string().min(1).max(256),
  secretAccessKey: z.string().min(1).max(512), sessionToken: z.string().min(1).max(10000).optional() });

/** A deliberately narrow S3 protocol: TLS, explicit credentials, no SDK profile
 * discovery, no multipart or retry after an ambiguous write. Dedicated prefix. */
export function backupObjectStore(config: z.infer<typeof ObjectStoreSchema>, credentials: z.infer<typeof ObjectCredentialsSchema>) {
  const endpoint = new URL(config.endpoint);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/") throw new Error("backup-endpoint-invalid");
  const client = new S3Client({ endpoint: endpoint.href, region: config.region,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey,
      ...(credentials.sessionToken ? { sessionToken: credentials.sessionToken } : {}) }, forcePathStyle: true, maxAttempts: 1,
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  const bucket = { Bucket: config.bucket, ExpectedBucketOwner: config.expectedBucketOwner };
  const object = (name: "snapshot.obs" | "authority.obs") => ({ ...bucket, Key: `${config.prefix.replace(/\/$/, "")}/${name}` });
  const signal = () => ({ abortSignal: AbortSignal.timeout(600000) });
  const absent = (error: unknown, name: string) => error instanceof Error && error.name === name;
  return {
    async assertPrivateDeletable() {
      const block = (await client.send(new GetPublicAccessBlockCommand(bucket), signal())).PublicAccessBlockConfiguration;
      if (!block?.BlockPublicAcls || !block.IgnorePublicAcls || !block.BlockPublicPolicy || !block.RestrictPublicBuckets) throw new Error("backup-private-access-required");
      try {
        const policy = await client.send(new GetBucketPolicyStatusCommand(bucket), signal());
        if (policy.PolicyStatus?.IsPublic !== false) throw new Error("backup-private-policy-required");
      } catch (error) { if (!absent(error, "NoSuchBucketPolicy")) throw error; }
      const versioning = await client.send(new GetBucketVersioningCommand(bucket), signal());
      // Suspended buckets still retain historical object versions. Reject both.
      if (versioning.Status !== undefined) throw new Error("backup-unversioned-bucket-required");
      try {
        const lock = await client.send(new GetObjectLockConfigurationCommand(bucket), signal());
        if (lock.ObjectLockConfiguration?.ObjectLockEnabled) throw new Error("backup-object-lock-forbidden");
      } catch (error) { if (!absent(error, "ObjectLockConfigurationNotFoundError")) throw error; }
      // Replicas would escape this implementation's exact-key rights deletion.
      try {
        const replication = await client.send(new GetBucketReplicationCommand(bucket), signal());
        if (replication.ReplicationConfiguration) throw new Error("backup-replication-forbidden");
      } catch (error) { if (!absent(error, "ReplicationConfigurationNotFoundError")) throw error; }
    },
    async put(name: "snapshot.obs" | "authority.obs", file: string) {
      const bytes = statSync(file).size;
      if (bytes > 4 * 1024 ** 3) throw new Error("backup-single-put-limit");
      const result = await client.send(new PutObjectCommand({ ...object(name), Body: createReadStream(file), ContentLength: bytes,
        ContentType: "application/octet-stream", CacheControl: "no-store" }), signal());
      if (result.VersionId && result.VersionId !== "null") throw new Error("backup-versioning-changed");
      return result.ETag ?? null;
    },
    async get(name: "snapshot.obs" | "authority.obs", file: string, maxBytes: number) {
      const result = await client.send(new GetObjectCommand(object(name)), signal());
      if (result.VersionId && result.VersionId !== "null") throw new Error("backup-versioning-changed");
      if (!result.Body || result.ContentLength === undefined || result.ContentLength > maxBytes || result.ContentLength < 36) throw new Error("backup-object-size-invalid");
      let size = 0;
      const bounded = new Transform({ transform(chunk: Buffer, _encoding, done) {
        size += chunk.length; done(size > maxBytes ? new Error("backup-object-too-large") : null, chunk);
      } });
      await pipeline(result.Body as Readable, bounded, createWriteStream(file, { flags: "wx", mode: 0o600 }), { signal: AbortSignal.timeout(600000) });
      if (size !== result.ContentLength) throw new Error("backup-object-truncated");
    },
    async removeSnapshot() { await client.send(new DeleteObjectCommand(object("snapshot.obs")), signal()); },
    close() { client.destroy(); },
  };
}
