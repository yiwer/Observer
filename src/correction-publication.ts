import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import MarkdownIt from "markdown-it";
import { CollectedEvidenceSchema, CorrectionRecordSchema, PublishedReportSchema, editionNames, type CollectedEvidence, type PublishedReport, type SixEditionRequest } from "./contracts.ts";
import { type SemanticVerifier } from "./gate-contracts.ts";
import { policyDigest, sourceFields, type SourcePolicy } from "./collection.ts";
import { evaluatePublication, escapeMarkdown, inputDigest } from "./publication-gate.ts";
import { correctionMarkdown } from "./correction-rendering.ts";
import { CorrectionSignalSchema, correctionStatus, initializeCorrectionQueue } from "./correction-queue.ts";
import { createProviderRouting, RoutingBoundaryError, type RoutingOptions } from "./provider-routing.ts";
import { MAX_ROUTING_AUDIT_BYTES, RoutingReceiptSchema } from "./routing-contracts.ts";
import { editionMarkdown } from "./private-archive.ts";
import { enqueueEmailNotification } from "./email-delivery.ts";
import { correctionSectionSource } from "./correction-scope.ts";
import { patrolCorrectionDeadline } from "./correction-patrol.ts";

type Edition = keyof typeof editionNames;
export interface CorrectionOptions { enabled: boolean; evidence(ids: string[]): CollectedEvidence[] }
interface Dependencies {
  clock(): string; mode: "production" | "test-fixture"; policies(): SourcePolicy[];
  read(versionId: string): PublishedReport;
  // Internal immutable, policy-checked history only; never an HTTP reader.
  historical(versionId: string): PublishedReport;
  recordChange(input: unknown): unknown;
  routing?: RoutingOptions; verifier?: SemanticVerifier; configuration?: CorrectionOptions;
}
class CorrectionFailure extends Error {}
function fail(reason: string): never { throw new CorrectionFailure(reason); }
// Parse only; this never renders HTML or follows links. Canonical anchors belong
// to the renderer (ordinal story-N, possibly vN-prefixed), not business story IDs.
const canonicalParser = new MarkdownIt("commonmark", { html: true, linkify: false, typographer: false });
function sectionReferences(markdown: string) {
  const anchors = new Set<string>(), targets = new Set<string>();
  const visit = (tokens: ReturnType<typeof canonicalParser.parse>): void => {
    for (const token of tokens) {
      if (token.type === "html_inline" || token.type === "html_block") {
        for (const match of token.content.matchAll(/<a\s+id="([^"]+)"\s*>/g)) anchors.add(match[1]!);
      }
      if (token.type === "link_open") {
        const href = token.attrGet("href");
        if (href?.startsWith("#")) {
          try { targets.add(decodeURIComponent(href.slice(1))); } catch { /* malformed fragments cannot name a rendered anchor */ }
        }
      }
      if (token.children) visit(token.children);
    }
  };
  visit(canonicalParser.parse(markdown, {}));
  return { anchors, targets };
}
export function correctionPublisher(database: DatabaseSync, dependencies: Dependencies) {
  initializeCorrectionQueue(database);
  const { clock } = dependencies;
  let processing = false;
  const latest = (date: string) => database.prepare("SELECT id FROM reports WHERE json_extract(payload,'$.version.businessDate')=? ORDER BY json_extract(payload,'$.version.version') DESC LIMIT 1").get(date)?.id as string | undefined;
  function policy(evidence: CollectedEvidence, now: string, stage: "model" | "distribution") {
    const source = dependencies.policies().find((entry) => entry.sourceId === evidence.sourceId);
    if (!source || source.review.status !== "approved" || !source.collection.enabled || source.version !== evidence.policyVersion || policyDigest(source) !== evidence.policySha256 || source.sourceType !== evidence.sourceType) return fail("source-policy-invalid");
    if (evidence.retrievedAtUtc > now || evidence.discoveredAtUtc > evidence.retrievedAtUtc || evidence.expiresAtUtc <= now || evidence.publishedAtUtc && evidence.publishedAtUtc > now) return fail("evidence-expired-or-future");
    // Specialized raw social/project input retains its dedicated normal admission boundary.
    if (source.edition === "social-discourse" || source.edition === "github-projects") return fail("specialized-evidence-required");
    if (!source.model.enabled) return fail("model-forbidden");
    if (stage === "distribution" && (!source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled)) return fail("distribution-forbidden");
    if (stage === "distribution" && (!evidence.url || !evidence.title || !["url", "title"].every((field) => source.collection.fields.includes(field as "url") && source.storage.fields.includes(field as "url") && source.distribution.fields.includes(field as "url")))) return fail("citation-unavailable");
    return source;
  }
  return { async processNext(signal?: AbortSignal) {
    if (!dependencies.configuration?.enabled || processing || signal?.aborted) return;
    processing = true;
    const owner = randomUUID();
    let inputId: string | undefined, routing: ReturnType<typeof createProviderRouting> | undefined;
    let routingCompleted = false;
    let patrolDeadline: string | null = null;
    let patrolDeadlineSignal: AbortSignal | undefined, plannedPauseDuringVerification = false;
    const patrolDeadlineReached = () => !!inputId?.startsWith("patrol:") && !!patrolDeadline && (patrolDeadlineSignal?.aborted || clock() >= patrolDeadline);
    const checkPatrolDeadline = () => { if (patrolDeadlineReached()) fail("patrol-planned-pause"); };
    try {
      database.exec("BEGIN IMMEDIATE");
      let row: Record<string, unknown> | undefined;
      try {
        // A crashed verification may be re-run; no publication/send occurs before the CAS transaction.
        database.prepare("UPDATE correction_signals SET state='pending',owner=NULL,lease_until_utc=NULL WHERE state='processing' AND lease_until_utc<=?").run(clock());
        patrolDeadline = patrolCorrectionDeadline(clock());
        row = database.prepare("SELECT * FROM correction_signals WHERE state='pending' AND (signal_id NOT LIKE 'patrol:%' OR ?=1) AND NOT EXISTS (SELECT 1 FROM correction_signals WHERE state='processing') ORDER BY received_at_utc,rowid LIMIT 1").get(patrolDeadline ? 1 : 0);
        if (row) database.prepare("UPDATE correction_signals SET state='processing',owner=?,lease_until_utc=? WHERE signal_id=?").run(owner, new Date(Date.parse(clock()) + 3700000).toISOString(), String(row.signal_id));
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      if (!row) return;
      inputId = String(row.signal_id);
      if (inputId.startsWith("patrol:") && patrolDeadline) {
        patrolDeadlineSignal = AbortSignal.timeout(Math.max(1, Date.parse(patrolDeadline) - Date.parse(clock())));
        signal = signal ? AbortSignal.any([signal, patrolDeadlineSignal]) : patrolDeadlineSignal;
      }
      const input = CorrectionSignalSchema.parse(JSON.parse(String(row.payload))), date = input.expectedCurrentVersionId.slice(0, 10);
      if (latest(date) !== input.expectedCurrentVersionId) fail("stale-current-version");
      const previous = dependencies.read(input.expectedCurrentVersionId);
      const sectionSource = (edition: Edition) => correctionSectionSource(previous, edition, dependencies.historical);
      const original = input.affected.map((reference) => {
        const report = dependencies.historical(reference.versionId);
        const story = report.record.stories.find((entry) => entry.id === reference.storyId);
        if (!story || story.schemaVersion !== 2 || report.version.version > previous.version.version) return fail("affected-statement-unavailable");
        const claim = story.claims.find((entry) => entry.id === reference.claimId);
        if (!claim || report.record.schemaVersion === 1 || !report.record.publicationGate.decisions.some((entry) => entry.storyId === story.id && entry.claimId === claim.id && entry.outcome === "published")) return fail("affected-statement-unavailable");
        if (story.edition !== input.finding.edition) return fail("one-primary-edition-per-signal");
        let present = false;
        try { present = editionMarkdown(previous, story.edition).includes(escapeMarkdown(claim.text)); } catch { /* no current section */ }
        const resolving = previous.record.schemaVersion === 12 && previous.record.revision.revisionReason === "withdrawal" && previous.record.revision.affected.some((entry) => entry.versionId === reference.versionId && entry.storyId === reference.storyId && entry.claimId === reference.claimId);
        if ((!present || sectionSource(story.edition) !== reference.versionId) && !resolving) return fail("affected-statement-no-longer-current");
        return { ...reference, edition: story.edition, claim };
      });
      const evidence = CollectedEvidenceSchema.array().parse(dependencies.configuration.evidence(input.evidence.map((entry) => entry.evidenceId)));
      if (evidence.length !== input.evidence.length || input.evidence.some((entry) => evidence.filter((item) => item.id === entry.evidenceId && item.retrievedAtUtc === entry.retrievedAtUtc).length !== 1)) fail("correction-evidence-unavailable-or-changed");
      if (evidence.some((entry) => entry.retrievedAtUtc <= previous.version.publishedAtUtc)) fail("fresh-correction-evidence-required");
      const captured = clock();
      const modelEvidence = evidence.map((entry) => {
        const source = policy(entry, captured, "model"), value = structuredClone(entry);
        for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.model.fields.includes(field)) delete value[field];
        return value;
      });
      // Historical derived wording must still be eligible for model processing.
      for (const entry of original) for (const oldEvidence of dependencies.historical(entry.versionId).record.evidenceBundle.evidence.filter((item) => entry.claim.evidenceIds.includes(item.id))) {
        const source = dependencies.policies().find((item) => item.sourceId === oldEvidence.sourceId);
        if (!source?.model.enabled) fail("original-context-model-forbidden");
      }
      const task = { schemaVersion: 2 as const, taskId: `correction:${input.signalId}`, businessDate: date, configurationId: previous.record.configurationId,
        evidenceBundle: { schemaVersion: 2 as const, id: `correction:${input.signalId}`, businessDate: date, configurationId: previous.record.configurationId,
          windowStartUtc: previous.record.evidenceBundle.cutoffUtc, cutoffUtc: captured, evidence: modelEvidence, coverageGaps: [] },
        editions: (Object.keys(editionNames) as Edition[]).map((edition) => ({ edition, evidenceIds: edition === input.finding.edition ? evidence.map((entry) => entry.id) : [] })) } satisfies SixEditionRequest;
      const policyCheck = (ids: string[], stage: "model" | "distribution", at: string) => {
        try { for (const id of ids) { const item = evidence.find((entry) => entry.id === id); if (!item) return "unknown-evidence-reference"; policy(item, at, stage); } return null; }
        catch (error) { return error instanceof CorrectionFailure ? error.message : "source-policy-unavailable"; }
      };
      if (dependencies.routing) routing = createProviderRouting(inputId.startsWith("patrol:") && patrolDeadline ? { ...dependencies.routing, assemblyIdentity: dependencies.routing, publicationDeadlineUtc: patrolDeadline } : dependencies.routing, task, (receipt) => {
        const safe = RoutingReceiptSchema.parse(receipt), payload = JSON.stringify(safe);
        if (Buffer.byteLength(payload) > Math.min(MAX_ROUTING_AUDIT_BYTES, safe.configuration.limits.maxAuditBytes)) fail("routing-audit-capacity-exceeded");
        database.prepare("INSERT INTO routing_runs VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(safe.runId, payload);
      }, () => ({ status: "available", linkEvidenceIds: evidence.map((entry) => entry.id) }), (ids) => {
        const failure = policyCheck(ids, "model", clock()); if (failure) fail(failure);
      }, signal);
      if (dependencies.mode === "production" && (!routing || dependencies.routing?.executionScope !== "live")) fail("correction-routing-unavailable");
      const candidates = [input.finding, ...(input.replacement ? [input.replacement] : [])];
      const verifier: SemanticVerifier | undefined = routing ? { verify: async (verificationInput) => {
        try {
          const result = await routing!.verify(verificationInput);
          // The optional second-provider review absorbs its own errors. Its
          // persisted cancellation must also keep the planned pause recoverable.
          if (patrolDeadlineReached() && routing!.receipt().attempts.some((attempt) => attempt.status === "failed" &&
            attempt.finishedAtUtc && attempt.finishedAtUtc >= patrolDeadline! && ["cancelled", "total-deadline", "timeout"].includes(attempt.reason ?? ""))) plannedPauseDuringVerification = true;
          return result;
        }
        catch (error) {
          // Only the planned routing cancellation is resumable; semantic, policy,
          // qualification and cleanup failures retain their existing terminal result.
          if (patrolDeadlineReached() && error instanceof RoutingBoundaryError && ["cancelled", "total-deadline", "timeout"].includes(error.message)) plannedPauseDuringVerification = true;
          throw error;
        }
      } } : dependencies.verifier;
      const result = await evaluatePublication({ request: { ...task, schemaVersion: 1 }, stories: candidates, verifier,
        domainRules: true, recordVerifierDispatch: true, clock,
        revisionContext: { purpose: "correction-review", originalStatements: original.map(({ referenceId, versionId, storyId, claim }) => ({ referenceId, versionId, storyId, claim })), findingStoryId: input.finding.id },
        modelPolicyCheck: (ids, at) => policyCheck(ids, "model", at),
        publicationPolicyCheck: (ids, claim, at) => claim.kind === "quotation" ? "correction-quotation-not-supported" : policyCheck(ids, "distribution", at),
        ...(routing ? { reviewDecision: routing.reviewDecision } : {}),
      });
      if (plannedPauseDuringVerification) fail("patrol-planned-pause");
      const assessment = result.publicationGate.verification?.assessments.find((entry) => entry.storyId === input.finding.id);
      const judgment = assessment?.revision;
      if (!judgment || judgment.affectedReferenceIds.length !== original.length || new Set(judgment.affectedReferenceIds).size !== original.length || original.some((entry) => !judgment.affectedReferenceIds.includes(entry.referenceId))) fail("revision-judgment-unavailable");
      if (judgment.classification === "new-development") fail("ordinary-new-development");
      if (judgment.classification === "insufficient" || !result.stories.some((entry) => entry.id === input.finding.id)) fail("correction-finding-not-gated");
      const replacement = input.replacement && result.stories.find((entry) => entry.id === input.replacement!.id);
      const completeReplacement = replacement && replacement.claims.length === input.replacement!.claims.length;
      const major = judgment.classification === "unresolved-major-error" || judgment.impact !== "nonmaterial-transcription" || assessment?.domain?.risk.level === "high";
      const reason = judgment.classification === "unresolved-major-error" || !completeReplacement ? "withdrawal" as const : "correction" as const;
      if (reason === "withdrawal" && !major) fail("replacement-not-gated");
      if (reason === "correction" && original.every((entry) => replacement!.claims.some((claim) => claim.text === entry.claim.text))) fail("unchanged-factual-content");
      const affectedEditions = new Set<Edition>(original.map((entry) => entry.edition));
      const sections: Array<{ edition: Edition; sourceVersionId: string; markdown: string }> = [];
      for (const edition of Object.keys(editionNames) as Edition[]) {
        let text: string;
        try { text = editionMarkdown(previous, edition); } catch { continue; }
        if (original.some((entry) => text.includes(escapeMarkdown(entry.claim.text)))) affectedEditions.add(edition);
        sections.push({ edition, sourceVersionId: sectionSource(edition), markdown: text });
      }
      const references = sections.map((section) => ({ edition: section.edition, ...sectionReferences(section.markdown) }));
      // Replacing an Edition removes every old anchor it owned, including other
      // stories. Expand to a fixed point so no inherited section depends on any
      // removed section. At most six Editions can be added; unrelated text stays exact.
      for (let pass = 0; pass < sections.length; pass++) {
        const removedAnchors = new Set(references.filter((entry) => affectedEditions.has(entry.edition)).flatMap((entry) => [...entry.anchors]));
        const dependent = references.filter((entry) => !affectedEditions.has(entry.edition) && [...entry.targets].some((target) => removedAnchors.has(target)));
        if (!dependent.length) break;
        for (const entry of dependent) affectedEditions.add(entry.edition);
      }
      const affected = [...affectedEditions], publishedAtUtc = clock(), version = previous.version.version + 1, versionId = `${date}-v${version}`;
      const stories = result.stories.filter((story) => story.id === input.finding.id || reason === "correction" && story.id === input.replacement?.id);
      const retainedIds = new Set(stories.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)));
      const retained = evidence.filter((entry) => retainedIds.has(entry.id));
      const coverageGaps = [...(previous.record.schemaVersion === 11 ? previous.record.recovery?.coverageGaps ?? previous.record.coverageGaps : previous.record.coverageGaps).filter((gap) => !affected.includes(gap.edition)),
        ...affected.map((edition) => ({ edition, reason: reason === "withdrawal" ? "withdrawn-unresolved-major-error" : "correction-replaces-affected-edition" }))];
      const previousAvailable = previous.record.schemaVersion === 12 ? previous.record.revision.availableEditions : previous.record.schemaVersion === 11 ? previous.record.recovery?.availableEditions ?? [] : previous.record.stories.map((story) => story.edition);
      const record = CorrectionRecordSchema.parse({ schemaVersion: 12, editorialContract: "observer-correction-v1", publicationMode: dependencies.mode === "production" ? "scheduled" : "test-fixture", id: `${versionId}-record`, businessDate: date, businessTimezone: "Asia/Shanghai",
        configurationId: previous.record.configurationId, taskId: task.taskId, applicationVersion: "0.1.0", stories, coverageGaps,
        evidenceBundle: { ...task.evidenceBundle, schemaVersion: 3, sourceBundleSchemaVersion: 2, evidence: retained.map((entry) => {
          const source = policy(entry, publishedAtUtc, "distribution"), { content: _content, expiresAtUtc: _expires, trust: _trust, policyVersion, policySha256, ...metadata } = entry;
          for (const field of sourceFields) if (field !== "content" && (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field))) delete metadata[field];
          return { ...metadata, origin: { kind: "collected", policyVersion, policySha256 } };
        }) },
        sourcePolicyDecisions: retained.map((entry) => ({ evidenceId: entry.id, decision: "source-policy-v1", sourceId: entry.sourceId, policyVersion: entry.policyVersion, policySha256: entry.policySha256, attribution: policy(entry, publishedAtUtc, "distribution").citation.attribution })),
        publicationGate: { ...result.publicationGate, checkedAtUtc: publishedAtUtc, unconfirmedItems: [] },
        revision: { signalId: input.signalId, previousVersionId: previous.version.id, revisionReason: reason, purpose: "correction-review", receivedAtUtc: String(row.received_at_utc),
          originalBundleId: previous.record.schemaVersion === 12 ? previous.record.revision.originalBundleId : previous.record.evidenceBundle.id,
          originalCutoffUtc: previous.record.schemaVersion === 12 ? previous.record.revision.originalCutoffUtc : previous.record.evidenceBundle.cutoffUtc,
          affected: original.map(({ claim: _claim, ...reference }) => reference), affectedEditions: affected, findingStoryId: input.finding.id,
          severity: major ? "major" : "minor", reason: reason === "withdrawal" ? "unresolved-major-error" : judgment.impact,
          inherited: sections.filter((section) => !affected.includes(section.edition)),
          availableEditions: [...new Set([...previousAvailable.filter((edition) => !affected.includes(edition)), ...(reason === "correction" ? [input.finding.edition] : [])])],
          routingRunId: routing?.receipt().runId ?? null },
      });
      const canonicalMarkdown = correctionMarkdown(record);
      const report = PublishedReportSchema.parse({ version: { schemaVersion: 12, editorialContract: record.editorialContract, id: versionId, briefId: date, businessDate: date,
        version, publishedAtUtc, revisionReason: reason, previousVersionId: previous.version.id, provenance: previous.version.provenance,
        reportRecordId: record.id, reportRecordSha256: inputDigest(record), canonicalMarkdownSha256: inputDigestText(canonicalMarkdown),
        content: "degraded", timing: "timing" in previous.version ? previous.version.timing : "pending" }, record, canonicalMarkdown });
      checkPatrolDeadline();
      routing?.authorize(true);
      routing?.freeze();
      database.exec("BEGIN IMMEDIATE");
      try {
        checkPatrolDeadline();
        if (signal?.aborted) fail("correction-cancelled");
        if (latest(date) !== previous.version.id) fail("stale-current-version");
        if (!database.prepare("SELECT 1 FROM correction_signals WHERE signal_id=? AND state='processing' AND owner=?").get(inputId, owner)) fail("correction-lease-lost");
        dependencies.read(previous.version.id);
        for (const entry of retained) policy(entry, clock(), "distribution");
        checkPatrolDeadline();
        routing?.authorize(true);
        database.prepare("INSERT INTO reports(id,payload,development_capture_sha256) VALUES (?,?,NULL)").run(versionId, JSON.stringify(report));
        dependencies.recordChange({ eventId: `correction:${input.signalId}`, kind: reason, versionId: previous.version.id, replacementVersionId: versionId, reasonReference: `correction:${input.signalId}` });
        // Old full-report exports can contain invalid overview/cross-references. Revoke every earlier whole version of this date.
        for (const old of database.prepare("SELECT id FROM reports WHERE json_extract(payload,'$.version.businessDate')=? AND id!=?").all(date, versionId)) {
          dependencies.recordChange({ eventId: `revoke:${versionId}:${old.id}`, kind: "withdrawal", versionId: String(old.id), replacementVersionId: null, reasonReference: `correction:${input.signalId}` });
        }
        if (reason === "correction" && major) enqueueEmailNotification(database, { versionId, kind: "significant-correction", atUtc: publishedAtUtc });
        database.prepare("UPDATE scheduled_tasks SET latest_version_id=?,latest_readable_at_utc=NULL,content_state='degraded',state='published',recovery_state='closed',owner=NULL,pid=NULL WHERE business_date=?")
          .run(versionId, date);
        database.prepare("UPDATE correction_signals SET state='published',version_id=?,reason=?,owner=NULL,lease_until_utc=NULL WHERE signal_id=? AND owner=?")
          .run(versionId, reason, inputId, owner);
        checkPatrolDeadline();
        routing?.complete(versionId);
        database.exec("COMMIT");
        routingCompleted = true;
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return correctionStatus(database, inputId);
    } catch (error) {
      const reason = error instanceof CorrectionFailure ? error.message : "correction-processing-failed";
      if (routing && !routingCompleted) { try { routing.complete(null, reason); } catch { /* persisted incomplete run remains diagnostic */ } }
      if (!inputId) throw error;
      const state = reason === "patrol-planned-pause" ? "pending" : reason === "stale-current-version" || reason === "correction-lease-lost" ? "conflict" : reason === "ordinary-new-development" ? "deferred-next-edition" : reason === "unchanged-factual-content" ? "no-op" : "blocked";
      database.prepare("UPDATE correction_signals SET state=?,reason=?,owner=NULL,lease_until_utc=NULL WHERE signal_id=? AND owner=?").run(state, reason, inputId, owner);
      return correctionStatus(database, inputId);
    } finally { processing = false; }
  } };
}

const inputDigestText = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
