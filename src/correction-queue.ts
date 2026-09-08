import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { CandidateV2Schema } from "./gate-contracts.ts";
import { inputDigest } from "./publication-gate.ts";
import { PrivateApiError } from "./private-access.ts";

const id = z.string().regex(/^[A-Za-z0-9:_-]{1,160}$/);
const versionId = z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/);
export const CorrectionSignalSchema = z.strictObject({
  schemaVersion: z.literal(1), signalId: id, expectedCurrentVersionId: versionId,
  affected: z.array(z.strictObject({ referenceId: id, versionId, storyId: z.string().min(1).max(200), claimId: z.string().min(1).max(200) })).min(1).max(20),
  evidence: z.array(z.strictObject({ evidenceId: z.string().min(1).max(200), retrievedAtUtc: z.iso.datetime({ precision: 3, offset: false }) })).min(1).max(20),
  // These are untrusted candidates. Only independently gated wording can be published.
  finding: CandidateV2Schema.refine((story) => story.claims.length === 1 && story.claims[0]!.kind === "fact"),
  replacement: CandidateV2Schema.nullable(),
});
export type CorrectionSignal = z.infer<typeof CorrectionSignalSchema>;
export function initializeCorrectionQueue(database: DatabaseSync) {
  database.exec(`CREATE TABLE IF NOT EXISTS correction_signals (
    signal_id TEXT PRIMARY KEY, identity_key TEXT NOT NULL UNIQUE, input_digest TEXT NOT NULL, payload TEXT NOT NULL,
    received_at_utc TEXT NOT NULL, state TEXT NOT NULL, reason TEXT, version_id TEXT, owner TEXT, lease_until_utc TEXT);
    CREATE INDEX IF NOT EXISTS correction_pending ON correction_signals(state,received_at_utc);`);
}
export function correctionStatus(database: DatabaseSync, signalId: string) {
  const row = database.prepare("SELECT signal_id,state,reason,version_id,received_at_utc FROM correction_signals WHERE signal_id=?").get(signalId);
  if (!row) throw new PrivateApiError("correction-not-found", 404);
  return { schemaVersion: 1, signalId: String(row.signal_id), state: String(row.state), reason: row.reason as string | null,
    versionId: row.version_id as string | null, receivedAtUtc: String(row.received_at_utc) };
}
export function enqueueCorrection(database: DatabaseSync, value: unknown, atUtc: string) {
  const parsed = CorrectionSignalSchema.safeParse(value);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data)) > 256 * 1024) throw new PrivateApiError("invalid-correction-signal");
  const signal = parsed.data, { signalId, ...body } = signal;
  if (new Set(signal.affected.map((entry) => entry.referenceId)).size !== signal.affected.length || new Set(signal.evidence.map((entry) => entry.evidenceId)).size !== signal.evidence.length ||
    signal.affected.some((entry) => entry.versionId.slice(0, 10) !== signal.expectedCurrentVersionId.slice(0, 10)) ||
    signal.evidence.some((entry) => entry.retrievedAtUtc > atUtc) || signal.replacement?.edition && signal.replacement.edition !== signal.finding.edition ||
    signal.finding.id === signal.replacement?.id) throw new PrivateApiError("invalid-correction-signal");
  const identity = inputDigest([signal.affected.map(({ versionId, storyId, claimId }) => [versionId, storyId, claimId]).sort(), signal.evidence.map((entry) => [entry.evidenceId, entry.retrievedAtUtc]).sort()]);
  const digest = inputDigest(body);
  database.prepare("INSERT INTO correction_signals VALUES (?,?,?,?,?,'pending',NULL,NULL,NULL,NULL) ON CONFLICT DO NOTHING")
    .run(signalId, identity, digest, JSON.stringify(signal), atUtc);
  const row = database.prepare("SELECT signal_id,input_digest FROM correction_signals WHERE signal_id=?").get(signalId) ??
    database.prepare("SELECT signal_id,input_digest FROM correction_signals WHERE identity_key=?").get(identity)!;
  if (row.input_digest !== digest) throw new PrivateApiError("correction-signal-conflict", 409);
  return correctionStatus(database, String(row.signal_id));
}
