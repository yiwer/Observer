import { createHash } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

/** Private to one synchronous observation read phase. Permissions are checked
 * by each caller before access and again before the owning scope returns. */
interface Payload { raw: string; sha256: string; bytes: number; decoded?: unknown; }
type MetadataRow = Record<string, string | number | null>;
export interface GitHubReadBudget {
  bytes: number;
  origins: Set<string>;
  rows: Map<string, Payload | null>;
  permissions: Map<string, () => boolean>;
  metadataRows: number;
  metadataBytes: number;
  metadata: Map<string, MetadataRow[] | null>;
}

export const createGitHubReadBudget = (): GitHubReadBudget => ({ bytes: 0, origins: new Set(), rows: new Map(), permissions: new Map(), metadataRows: 0, metadataBytes: 0, metadata: new Map() });

/** The fixed projection is serialized inside SQLite, so no unbounded metadata
 * text reaches JavaScript before its actual UTF-8 length is charged. Length
 * results themselves cost one row and twenty ASCII bytes. Cached queries do
 * not execute SQL; refreshes and failed attempts never refund their reads. */
export function readGitHubMetadata(db: DatabaseSync, budget: GitHubReadBudget, sql: string, columns: string[], parameters: SQLInputValue[] = [], maximumRows = 1, rowLimit = 4096, refresh = false): MetadataRow[] {
  const identity = JSON.stringify([sql, columns, parameters, maximumRows, rowLimit]);
  if (!refresh && budget.metadata.has(identity)) {
    const saved = budget.metadata.get(identity);
    if (!saved) throw new Error("github-momentum-metadata-limit");
    return saved;
  }
  budget.metadata.set(identity, null);
  if (!columns.every((column) => /^[a-z_][a-z0-9_]*$/.test(column)) || !Number.isSafeInteger(maximumRows) || maximumRows < 1 || maximumRows > 16384) throw new Error("github-momentum-metadata-limit");
  const remainingRows = 16384 - budget.metadataRows, remainingBytes = 8 * 1024 * 1024 - budget.metadataBytes;
  const limit = Math.min(maximumRows + 1, remainingRows, Math.floor(remainingBytes / 20));
  if (limit < 1) throw new Error("github-momentum-metadata-limit");
  const projection = `SELECT json_object(${columns.map((column) => `'${column}',"${column}"`).join(",")}) AS metadata FROM (${sql}) LIMIT ${maximumRows + 1}`;
  const lengths = db.prepare(`SELECT printf('%020d',length(CAST(metadata AS BLOB))) AS size FROM (${projection}) LIMIT ${limit}`).all(...parameters);
  budget.metadataRows += lengths.length; budget.metadataBytes += lengths.length * 20;
  if (lengths.length > maximumRows || limit < maximumRows + 1 && lengths.length === limit) throw new Error("github-momentum-metadata-limit");
  const sizes = lengths.map((row) => Number(row.size)), bytes = sizes.reduce((sum, size) => sum + size, 0);
  if (sizes.some((size) => !Number.isSafeInteger(size) || size <= 0 || size > rowLimit) || budget.metadataRows + sizes.length > 16384 || budget.metadataBytes + bytes > 8 * 1024 * 1024) throw new Error("github-momentum-metadata-limit");
  budget.metadataRows += sizes.length; budget.metadataBytes += bytes;
  if (!sizes.length) { budget.metadata.set(identity, []); return []; }
  // A changed row must not turn the preflight into permission to retrieve a
  // larger string. The bounded window checks the same result before returning
  // text, including when used outside a caller's SQLite read transaction.
  const rows = db.prepare(`SELECT CASE WHEN SUM(length(CAST(metadata AS BLOB))) OVER ()=? AND SUM(1) OVER ()=? AND length(CAST(metadata AS BLOB))<=? THEN metadata ELSE NULL END AS metadata FROM (${projection}) LIMIT ${sizes.length}`)
    .all(bytes, sizes.length, rowLimit, ...parameters);
  if (rows.length !== sizes.length || rows.some((row, i) => typeof row.metadata !== "string" || Buffer.byteLength(row.metadata) !== sizes[i])) throw new Error("github-momentum-metadata-limit");
  const values = rows.map((row) => JSON.parse(String(row.metadata)) as MetadataRow);
  budget.metadata.set(identity, values);
  return values;
}

export function registerGitHubOrigin(budget: GitHubReadBudget, slot: string): void {
  if (!budget.origins.has(slot) && budget.origins.size >= 1000) throw new Error("github-development-origin-limit");
  budget.origins.add(slot);
}

export function readGitHubPayload(budget: GitHubReadBudget, table: string, key: string, bytes: number, read: () => string) {
  const identity = JSON.stringify([table, key]);
  if (budget.rows.has(identity)) {
    const saved = budget.rows.get(identity);
    if (!saved || saved.bytes !== bytes) throw new Error("github-development-origin-unavailable");
    return saved;
  }
  budget.rows.set(identity, null);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || budget.bytes + bytes > 64 * 1024 * 1024) throw new Error("github-development-origin-byte-limit");
  budget.bytes += bytes;
  const raw = read();
  if (Buffer.byteLength(raw) !== bytes) throw new Error("github-development-origin-unavailable");
  const value = { raw, bytes, sha256: createHash("sha256").update(raw).digest("hex") };
  budget.rows.set(identity, value);
  return value;
}

export function decodeGitHubPayload(payload: Payload): unknown {
  if (!Object.hasOwn(payload, "decoded")) payload.decoded = JSON.parse(payload.raw);
  return payload.decoded;
}

export function finishGitHubReadBudget(budget: GitHubReadBudget): void {
  try {
    if ([...budget.permissions.values()].some((allowed) => !allowed())) throw new Error("github-development-history-unavailable");
  } finally { budget.rows.clear(); budget.origins.clear(); budget.permissions.clear(); budget.metadata.clear(); }
}
