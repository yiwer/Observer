import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

export class PrivateApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
const lifetime = { pairing: 10 * 60_000, device: 90 * 86400_000, download: 5 * 60_000 };
export type Principal = { kind: "owner"; id: string } | { kind: "device"; id: string };
const pairingInput = z.strictObject({ pairingId: z.uuid(), code: z.string().min(1).max(128), deviceName: z.string().trim().min(1).max(80) });

/** Local management and HTTP readers share this durable store. No remote issuer. */
export function privateAccess(database: DatabaseSync, ownerToken: string, clock: () => string) {
  database.exec(`CREATE TABLE IF NOT EXISTS private_access_meta (id INTEGER PRIMARY KEY CHECK(id=1), epoch TEXT NOT NULL, signing_key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS device_pairings (id TEXT PRIMARY KEY, code_digest TEXT NOT NULL, created_at_utc TEXT NOT NULL,
      expires_at_utc TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at_utc TEXT);
    CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, credential_digest TEXT NOT NULL UNIQUE,
      created_at_utc TEXT NOT NULL, expires_at_utc TEXT NOT NULL, revoked_at_utc TEXT);
    CREATE TABLE IF NOT EXISTS pairing_rate (id INTEGER PRIMARY KEY CHECK(id=1), window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);`);
  database.prepare("INSERT OR IGNORE INTO private_access_meta VALUES (1,?,?)").run(randomUUID(), randomBytes(32).toString("base64url"));
  const metadata = database.prepare("SELECT * FROM private_access_meta WHERE id=1").get()!;
  const epoch = String(metadata.epoch), signingKey = String(metadata.signing_key);
  const transaction = <T>(work: () => T): T => {
    database.exec("BEGIN IMMEDIATE");
    try { const value = work(); database.exec("COMMIT"); return value; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  };
  function active(principal: Principal): boolean {
    if (principal.kind === "owner") return ownerToken.length >= 32 && equal(principal.id, digest(ownerToken));
    const row = database.prepare("SELECT revoked_at_utc,expires_at_utc FROM devices WHERE id=?").get(principal.id);
    return !!row && row.revoked_at_utc === null && String(row.expires_at_utc) > clock();
  }
  function authenticate(credential: string | undefined): Principal {
    if (!credential || credential.length > 512) throw new PrivateApiError("unauthorized", 401);
    if (ownerToken.length >= 32 && equal(credential, ownerToken)) return { kind: "owner", id: digest(ownerToken) };
    const match = /^obs_device\.([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(credential);
    const row = match ? database.prepare("SELECT credential_digest FROM devices WHERE id=?").get(match[1]!) : null;
    const principal: Principal = { kind: "device", id: match?.[1] ?? "" };
    if (!row || !equal(String(row.credential_digest), digest(credential)) || !active(principal)) throw new PrivateApiError("unauthorized", 401);
    return principal;
  }
  function seal(value: object) {
    const payload = Buffer.from(JSON.stringify({ ...value, epoch })).toString("base64url");
    return `${payload}.${createHmac("sha256", signingKey).update(payload).digest("base64url")}`;
  }
  function unseal(token: string): Record<string, unknown> {
    try {
      if (token.length > 4096) throw new Error();
      const [payload, signature, extra] = token.split(".");
      if (!payload || !signature || extra || !equal(signature, createHmac("sha256", signingKey).update(payload).digest("base64url"))) throw new Error();
      const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
      if (value.epoch !== epoch) throw new Error();
      return value;
    } catch { throw new PrivateApiError("invalid-cursor-or-signature"); }
  }
  return {
    epoch, authenticate, seal, unseal,
    issuePairing() {
      const pairingId = randomUUID(), code = randomBytes(12).toString("base64url"), createdAtUtc = clock();
      const expiresAtUtc = new Date(Date.parse(createdAtUtc) + lifetime.pairing).toISOString();
      database.prepare("INSERT INTO device_pairings (id,code_digest,created_at_utc,expires_at_utc) VALUES (?,?,?,?)")
        .run(pairingId, digest(code), createdAtUtc, expiresAtUtc);
      return { schemaVersion: 1, pairingId, code, expiresAtUtc, maxAttempts: 5 };
    },
    pair(input: unknown) {
      // Persist failed attempts too: errors are returned out of the committed transaction.
      const result = transaction(() => {
        const now = clock(), milliseconds = Date.parse(now);
        database.prepare("INSERT OR IGNORE INTO pairing_rate VALUES (1,?,0)").run(milliseconds);
        database.prepare("UPDATE pairing_rate SET window_start=?,attempts=0 WHERE id=1 AND window_start<=?").run(milliseconds, milliseconds - 60_000);
        const rate = database.prepare("SELECT attempts FROM pairing_rate WHERE id=1").get()!;
        if (Number(rate.attempts) >= 30) return new PrivateApiError("pairing-rate-limited", 429);
        database.prepare("UPDATE pairing_rate SET attempts=attempts+1 WHERE id=1").run();
        const parsed = pairingInput.safeParse(input);
        if (!parsed.success) return new PrivateApiError("invalid-pairing", 401);
        const row = database.prepare("SELECT * FROM device_pairings WHERE id=?").get(parsed.data.pairingId);
        if (!row || row.consumed_at_utc !== null || String(row.expires_at_utc) <= now || Number(row.attempts) >= 5) return new PrivateApiError("invalid-pairing", 401);
        database.prepare("UPDATE device_pairings SET attempts=attempts+1 WHERE id=?").run(parsed.data.pairingId);
        if (!equal(String(row.code_digest), digest(parsed.data.code))) return new PrivateApiError("invalid-pairing", 401);
        database.prepare("UPDATE device_pairings SET consumed_at_utc=? WHERE id=?").run(now, parsed.data.pairingId);
        const deviceId = randomUUID(), credential = `obs_device.${deviceId}.${randomBytes(32).toString("base64url")}`;
        const expiresAtUtc = new Date(milliseconds + lifetime.device).toISOString();
        database.prepare("INSERT INTO devices VALUES (?,?,?,?,?,NULL)").run(deviceId, parsed.data.deviceName, digest(credential), now, expiresAtUtc);
        return { schemaVersion: 1, deviceId, credential, expiresAtUtc };
      });
      if (result instanceof PrivateApiError) throw result;
      return result;
    },
    listDevices() {
      return database.prepare("SELECT id AS deviceId,name,created_at_utc AS createdAtUtc,expires_at_utc AS expiresAtUtc,revoked_at_utc AS revokedAtUtc FROM devices ORDER BY created_at_utc,id").all();
    },
    revokeDevice(deviceId: string) {
      if (!z.uuid().safeParse(deviceId).success) throw new PrivateApiError("invalid-device-id");
      const result = database.prepare("UPDATE devices SET revoked_at_utc=COALESCE(revoked_at_utc,?) WHERE id=?").run(clock(), deviceId);
      if (!result.changes) throw new PrivateApiError("not-found", 404);
      return { schemaVersion: 1, deviceId, revoked: true };
    },
    signDownload(versionId: string, format: string, edition: string | null, credential: string | undefined) {
      const principal = authenticate(credential), expiresAtUtc = new Date(Date.parse(clock()) + lifetime.download).toISOString();
      return { token: seal({ v: 1, purpose: "download", principal, versionId, format, edition, expiresAtUtc }), expiresAtUtc };
    },
    authorizeDownload(token: string, versionId: string, format: string, edition: string | null) {
      try {
        const grant = unseal(token);
        const principal = z.discriminatedUnion("kind", [z.object({ kind: z.literal("owner"), id: z.string() }), z.object({ kind: z.literal("device"), id: z.uuid() })]).parse(grant.principal);
        if (grant.v !== 1 || grant.purpose !== "download" || grant.versionId !== versionId || grant.format !== format || grant.edition !== edition ||
          typeof grant.expiresAtUtc !== "string" || grant.expiresAtUtc <= clock() || !active(principal)) throw new Error();
      } catch { throw new PrivateApiError("invalid-download-signature", 401); }
    },
  };
}
export type PrivateAccess = ReturnType<typeof privateAccess>;
