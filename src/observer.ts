import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AgentResultSchema, ProduceRequestSchema, PublishedReportSchema, SixEditionRequestSchema, EventEditionRequestSchema, EditionResearchSchema, EditionResearchEnvelopeSchema, ReportRecordSchema,
  editionNames, type AgentRunner, type AgentResult, type PublishedReport, type ReportRecord, type EditionRunner, type EditionResearch,
} from "./contracts.ts";
import { SourcePolicySchema, policyDigest, sourceFields, type SourcePolicy } from "./collection.ts";
import type { Claim, SemanticVerifier } from "./gate-contracts.ts";
import { evaluatePublication, gatedMarkdown } from "./publication-gate.ts";
import { evaluateBatchedPublication } from "./batched-publication-gate.ts";
import { arrangeEditions, sixEditionMarkdown, consistentRecord } from "./six-edition.ts";
import { arrangeEvents } from "./event-history.ts";
import { projectEventReceipt } from "./event-projection.ts";
import { consistentEvents } from "./event-integrity.ts";

export class ObserverError extends Error {
  code: string;
  agentRun?: AgentResult;
  constructor(code: string, agentRun?: AgentResult) {
    super(code); this.code = code;
    if (agentRun) this.agentRun = agentRun;
  }
}

export interface ObserverOptions {
  databasePath: string;
  ownerToken: string;
  mode: "production" | "test-fixture";
  clock?: () => string;
  runner?: AgentRunner;
  editionRunner?: EditionRunner;
  sourcePolicies?: SourcePolicy[];
  verifier?: SemanticVerifier;
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function markdown(record: ReportRecord): string {
  if (record.schemaVersion === 3 || record.schemaVersion === 4) return sixEditionMarkdown(record);
  if (record.schemaVersion === 2) return gatedMarkdown(record);
  const story = record.stories[0]!;
  const overview = Object.entries(editionNames).map(([edition, label]) =>
    `- ${label}：${edition === story.edition ? story.title : "Coverage Gap（本票尚未实现该栏）"}`,
  );
  const claims = story.claims.map((claim) => `${claim.text}\n\n${claim.evidenceIds.map((evidenceId) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === evidenceId)!;
    const decision = record.sourcePolicyDecisions.find((item) => item.evidenceId === evidenceId)!;
    return `来源：${decision.decision === "source-policy-v1" ? decision.attribution + " — " : ""}[${evidence.title}](${evidence.url}) [${evidence.id}]`;
  }).join("\n\n")}`);
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    "> 自动化测试固定替身产物；未经过真实研究或生产准入。",
    "## Today Overview", overview.join("\n"),
    `## ${editionNames[story.edition]}`, `### ${story.title}`, ...claims,
    ...(story.quotations ?? []).map((quote) => `引文 [${quote.evidenceId}]：${quote.text}`),
  ].join("\n\n") + "\n";
}

export function createObserver(options: ObserverOptions) {
  const policies = (options.sourcePolicies ?? []).map((source) => SourcePolicySchema.parse(source));
  function checkedPolicy(evidence: { sourceId: string; policyVersion: number; policySha256: string }) {
    const source = policies.find((source) => source.sourceId === evidence.sourceId);
    if (!source || source.review.status !== "approved" || !source.collection.enabled || source.version !== evidence.policyVersion || policyDigest(source) !== evidence.policySha256) throw new ObserverError("source-policy-invalid");
    return source;
  }
  if (Buffer.byteLength(options.ownerToken) < 32) throw new ObserverError("invalid-owner-token");
  mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(options.databasePath);
  database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  const storageVersion = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (storageVersion > 1) { database.close(); throw new ObserverError("unsupported-storage-version"); }
  if (storageVersion === 0) {
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE reports (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;
      CREATE TRIGGER immutable_report_delete BEFORE DELETE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;
      PRAGMA user_version = 1;
      COMMIT;
    `);
  }

  const historicalReport = (versionId: string): PublishedReport | undefined => {
    const row = database.prepare("SELECT payload FROM reports WHERE id = ?").get(versionId);
    if (!row) return undefined;
    const report = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
    if (report.record.schemaVersion !== 4 || report.version.schemaVersion !== 3 || report.version.id !== versionId ||
      report.version.reportRecordSha256 !== digest(JSON.stringify(report.record)) || report.version.canonicalMarkdownSha256 !== digest(report.canonicalMarkdown) ||
      !consistentRecord(report.record) || sixEditionMarkdown(report.record) !== report.canonicalMarkdown) throw new ObserverError("history-integrity-failed");
    return report;
  };

  return {
    async produce(input: unknown, runOptions?: { signal?: AbortSignal }) {
      if (options.mode !== "test-fixture") throw new ObserverError("publication-disabled");
      const parsedRequest = ProduceRequestSchema.or(SixEditionRequestSchema).or(EventEditionRequestSchema).safeParse(input);
      if (!parsedRequest.success) throw new ObserverError("invalid-request");
      const request = parsedRequest.data;
      if (request.schemaVersion === 1 ? !options.runner : request.evidenceBundle.evidence.length > 0 && !options.editionRunner) throw new ObserverError("runner-unavailable");
      const bundle = request.evidenceBundle;
      const modelRequest = structuredClone(request);
      if (!bundle.evidence.length && request.schemaVersion === 1) throw new ObserverError("evidence-unavailable");
      if (request.schemaVersion !== 1 && (new Set(request.editions.map((entry) => entry.edition)).size !== 6 || request.editions.some((entry) => new Set(entry.evidenceIds).size !== entry.evidenceIds.length || entry.evidenceIds.some((id) => !bundle.evidence.some((evidence) => evidence.id === id))))) throw new ObserverError("invalid-edition-input");
      if (modelRequest.evidenceBundle.schemaVersion === 2) {
        for (const evidence of modelRequest.evidenceBundle.evidence) {
          const source = checkedPolicy(evidence);
          if (!source.model.enabled) throw new ObserverError("model-forbidden");
          if (evidence.expiresAtUtc <= (options.clock ?? (() => new Date().toISOString()))()) throw new ObserverError("evidence-expired");
          for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.model.fields.includes(field)) delete evidence[field];
        }
      }
      if (bundle.businessDate !== request.businessDate || bundle.configurationId !== request.configurationId ||
        new Set(bundle.evidence.map((evidence) => evidence.id)).size !== bundle.evidence.length) {
        throw new ObserverError("invalid-bundle-identity");
      }
      if (bundle.windowStartUtc >= bundle.cutoffUtc || bundle.evidence.some((evidence) =>
        evidence.discoveredAtUtc > evidence.retrievedAtUtc || evidence.retrievedAtUtc > bundle.cutoffUtc ||
        (evidence.publishedAtUtc != null && evidence.publishedAtUtc > bundle.cutoffUtc))) {
        throw new ObserverError("invalid-evidence-window");
      }
      if (request.evidenceBundle.evidence.some((evidence) => evidence.content !== undefined && evidence.contentSha256 !== undefined && digest(evidence.content) !== evidence.contentSha256)) {
        throw new ObserverError("evidence-integrity-failed");
      }
      let runnerOutput: unknown;
      try { runnerOutput = modelRequest.schemaVersion === 1 ? await options.runner!.run(structuredClone(modelRequest), runOptions) : bundle.evidence.length ? await options.editionRunner!.run(structuredClone(modelRequest), runOptions) : {
        schemaVersion: 2, taskId: request.taskId, evidenceBundleId: bundle.id, configurationId: request.configurationId,
        editions: modelRequest.editions.map((entry) => ({ edition: entry.edition, status: "no-evidence" })),
      }; }
      catch { throw new ObserverError("agent-unknown"); }
      let research: EditionResearch | undefined;
      let results: AgentResult[];
      let publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
      const validFixtureRun = (result: AgentResult) => {
        const protocolFixture = ["codex", "claude"].includes(result.provider) && result.execution?.provenance === "protocol-fixture" && options.verifier;
        return (result.provider === "fixture" || !!protocolFixture) && result.startedAtUtc >= bundle.cutoffUtc &&
          result.startedAtUtc <= result.finishedAtUtc && result.finishedAtUtc <= publishedAtUtc;
      };
      if (request.schemaVersion !== 1) {
        const parsed = EditionResearchEnvelopeSchema.safeParse(runnerOutput);
        if (!parsed.success) throw new ObserverError("agent-invalid-output");
        research = { ...parsed.data, editions: parsed.data.editions.map((entry) => {
          const checked = EditionResearchSchema.shape.editions.element.safeParse(entry);
          return checked.success ? checked.data : { edition: entry.edition, status: "invalid-output" as const };
        }) };
        if (research.taskId !== request.taskId || research.evidenceBundleId !== bundle.id || research.configurationId !== request.configurationId ||
          new Set(research.editions.map((entry) => entry.edition)).size !== 6 || new Set(request.editions.map((entry) => entry.edition)).size !== 6) throw new ObserverError("uncorrelated-agent-result");
        research.editions = research.editions.map((entry) => {
          const assigned = request.editions.find((item) => item.edition === entry.edition)!;
          const invalid = { edition: entry.edition, status: "invalid-output" as const };
          if (entry.status === "no-evidence") return assigned.evidenceIds.length ? invalid : entry;
          if (entry.status === "invalid-output") return entry;
          if (!assigned.evidenceIds.length || entry.result.taskId !== `${request.taskId}:${entry.edition}` ||
            entry.result.evidenceBundleId !== bundle.id || entry.result.configurationId !== request.configurationId ||
            !validFixtureRun(entry.result) ||
            entry.result.status === "succeeded" && entry.result.stories.some((story) => story.edition !== entry.edition || story.claims.some((claim) => claim.evidenceIds.some((id) => !assigned.evidenceIds.includes(id))))) return invalid;
          return entry;
        });
        results = research.editions.flatMap((entry) => entry.status === "completed" ? [entry.result] : []);
      } else {
        const parsedResult = AgentResultSchema.safeParse(runnerOutput);
        if (!parsedResult.success) throw new ObserverError("agent-invalid-output");
        results = [parsedResult.data];
      }
      for (const result of results) {
        if (!validFixtureRun(result)) throw new ObserverError("invalid-fixture-run");
        if ((request.schemaVersion === 1 && result.taskId !== request.taskId) || result.evidenceBundleId !== request.evidenceBundle.id || result.configurationId !== request.configurationId) {
          throw new ObserverError("uncorrelated-agent-result");
        }
        if (request.schemaVersion === 1 && result.status !== "succeeded") throw new ObserverError(`agent-${result.failure.category}`, result);
      }
      const stories = results.flatMap((result) => result.status === "succeeded" ? result.stories : []);
      if ((options.verifier || research) && stories.some((story) => story.schemaVersion === 1)) throw new ObserverError("legacy-candidate-disabled");
      const evidenceIds = new Set(request.evidenceBundle.evidence.map((evidence) => evidence.id));
      if (stories.some((story) => story.schemaVersion === 1 && story.claims.some((claim) => claim.evidenceIds.some((id) => !evidenceIds.has(id))))) {
        throw new ObserverError("unknown-evidence-reference");
      }
      if (stories.some((story) => story.schemaVersion === 1 && story.quotations?.some((quote) => !evidenceIds.has(quote.evidenceId)))) throw new ObserverError("unknown-evidence-reference");
      const gatedCandidates = stories.every((story) => story.schemaVersion === 2);
      if (bundle.schemaVersion === 2 && !gatedCandidates) {
        const quotationTotals = new Map<string, number>();
        for (const quotation of stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : [])) {
          const evidence = bundle.evidence.find((item) => item.id === quotation.evidenceId)!;
          const total = (quotationTotals.get(evidence.sourceId) ?? 0) + [...quotation.text].length;
          if (total > checkedPolicy(evidence).citation.maxCharacters) throw new ObserverError("citation-limit");
          quotationTotals.set(evidence.sourceId, total);
        }
        for (const evidence of bundle.evidence) {
          const source = checkedPolicy(evidence);
          if (!source.distribution.enabled || !source.distribution.allowDerivedText) throw new ObserverError("distribution-forbidden");
          if (!source.distribution.allowPermanentArchive) throw new ObserverError("archive-forbidden");
          if (!source.citation.enabled) throw new ObserverError("citation-forbidden");
          const quotations = stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : []).filter((quote) => quote.evidenceId === evidence.id);
          const researchContent = modelRequest.evidenceBundle.evidence.find((item) => item.id === evidence.id)?.content;
          if (quotations.some((quote) => !evidence.content?.includes(quote.text) || !researchContent?.includes(quote.text))) throw new ObserverError("quotation-unverified");
          for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field)) delete evidence[field];
          // The mutable source cache is the only place that retains source body text.
          delete evidence.content;
          if (!evidence.url || !evidence.title) throw new ObserverError("citation-unavailable");
        }
      }
      const story = stories[0];
      const commonRecord = {
        schemaVersion: 1, id: `${request.businessDate}-v1-record`,
        businessDate: request.businessDate, businessTimezone: "Asia/Shanghai",
        configurationId: request.configurationId, taskId: request.taskId, applicationVersion: "0.1.0",
        evidenceBundle: request.evidenceBundle, stories,
        coverageGaps: (Object.keys(editionNames) as Array<keyof typeof editionNames>)
          .filter((edition) => edition !== story?.edition)
          .map((edition) => ({ edition, reason: "not-implemented-in-fixture-spine" })),
        sourcePolicyDecisions: bundle.schemaVersion === 1 ? bundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "test-fixture-only" })) : bundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "source-policy-v1", sourceId: evidence.sourceId, policyVersion: evidence.policyVersion, policySha256: evidence.policySha256, attribution: checkedPolicy(evidence).citation.attribution })),
        agentResult: results[0],
      };
      let record: ReportRecord;
      if (stories.every((story) => story.schemaVersion === 2)) {
        const quotationTotals = new Map<string, number>();
        for (const claim of stories.flatMap((story) => story.claims)) {
          if (claim.kind !== "quotation") continue;
          const evidence = bundle.evidence.find((item) => item.id === claim.evidenceIds[0]);
          if (!evidence) continue;
          quotationTotals.set(evidence.sourceId, (quotationTotals.get(evidence.sourceId) ?? 0) + [...claim.originalText].length + (claim.translated ? [...claim.text].length : 0));
        }
        const modelPolicyCheck = (ids: string[], atUtc: string): string | null => {
          if (bundle.schemaVersion === 1) return null;
          for (const id of ids) {
            const evidence = bundle.evidence.find((item) => item.id === id)!;
            let source: SourcePolicy;
            try { source = checkedPolicy(evidence); } catch { return "source-policy-invalid"; }
            if (evidence.sourceType !== source.sourceType) return "source-policy-invalid";
            if (evidence.expiresAtUtc <= atUtc) return "evidence-expired";
            if (!source.model.enabled) return "model-forbidden";
          }
          return null;
        };
        const policyCheck = (ids: string[], claim: Claim, atUtc: string): string | null => {
          const modelFailure = modelPolicyCheck(ids, atUtc);
          if (modelFailure) return modelFailure;
          if (bundle.schemaVersion === 1) return null;
          for (const id of ids) {
            const evidence = bundle.evidence.find((item) => item.id === id)!;
            let source: SourcePolicy;
            try { source = checkedPolicy(evidence); } catch { return "source-policy-invalid"; }
            if (evidence.sourceType !== source.sourceType) return "source-policy-invalid";
            if (!source.distribution.enabled || !source.distribution.allowDerivedText) return "distribution-forbidden";
            if (!source.distribution.allowPermanentArchive) return "archive-forbidden";
            if (!source.citation.enabled) return "citation-forbidden";
            if (claim.kind === "quotation" && (quotationTotals.get(source.sourceId) ?? 0) > source.citation.maxCharacters) return "citation-limit";
            if (!["url", "title"].every((field) => source.collection.fields.includes(field as "url" | "title") && source.storage.fields.includes(field as "url" | "title") && source.distribution.fields.includes(field as "url" | "title")) || !evidence.url || !evidence.title) return "citation-unavailable";
          }
          return null;
        };
        const { completedAtUtc, ...gated } = await (research ? evaluateBatchedPublication : evaluatePublication)({ request: { ...modelRequest, schemaVersion: 1 }, stories, verifier: options.verifier,
          clock: options.clock ?? (() => new Date().toISOString()), modelPolicyCheck, publicationPolicyCheck: policyCheck });
        publishedAtUtc = completedAtUtc;
        if (gated.publicationGate.schemaVersion === 1) gated.publicationGate.verification = projectEventReceipt(gated.publicationGate.verification, gated.stories, request.schemaVersion === 3);
        else for (const batch of gated.publicationGate.batches) batch.verification = projectEventReceipt(batch.verification, gated.stories, request.schemaVersion === 3);
        const eligibleIds = new Set([...gated.stories.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)), ...gated.publicationGate.unconfirmedItems.flatMap((item) => item.evidenceIds)]);
        // The input digest and permitted Evidence identities preserve review correlation without raw text.
        const archiveBundle = { ...bundle, schemaVersion: 3 as const, sourceBundleSchemaVersion: bundle.schemaVersion, coverageGaps: bundle.schemaVersion === 2 ? bundle.coverageGaps : [], evidence: bundle.evidence.filter((evidence) => eligibleIds.has(evidence.id)).map((evidence) => {
          const { content: _content, ...metadata } = structuredClone(evidence);
          if ("policyVersion" in metadata) {
            const source = checkedPolicy(metadata);
            for (const field of sourceFields) if (field !== "content" && (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field))) delete metadata[field];
            const { policyVersion, policySha256, expiresAtUtc: _expiry, trust: _trust, ...retained } = metadata;
            return { ...retained, origin: { kind: "collected" as const, policyVersion, policySha256 } };
          }
          return { ...metadata, origin: { kind: "fixture" as const } };
        }) };
        const result = results[0];
        const agentMetadata = result?.status === "succeeded" ? (({ stories: _stories, ...metadata }) => metadata)(result) : result;
        record = { ...commonRecord, schemaVersion: 2, evidenceBundle: archiveBundle, agentResult: agentMetadata, ...gated,
          sourcePolicyDecisions: commonRecord.sourcePolicyDecisions.filter((decision) => eligibleIds.has(decision.evidenceId)),
          coverageGaps: Object.keys(editionNames).filter((edition) => !gated.stories.some((story) => story.edition === edition)).map((edition) => ({ edition, reason: "no-publishable-claims" })),
        } as ReportRecord;
        if (research) {
          if (request.schemaVersion === 3) {
            let legacyHistory = false;
            const withheldHistory = new Set<string>();
            const history = database.prepare("SELECT payload FROM reports WHERE id < ? ORDER BY id").all(`${request.businessDate}-v1`).flatMap((row) => {
              const old = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
              if (old.record.businessDate >= request.businessDate || old.version.publishedAtUtc > bundle.cutoffUtc || old.record.evidenceBundle.cutoffUtc > bundle.cutoffUtc) return [];
              if (old.record.schemaVersion !== 4 || old.version.schemaVersion !== 3) { legacyHistory ||= old.record.stories.some((story) => story.edition !== "github-projects"); return []; }
              if (old.version.reportRecordSha256 !== digest(JSON.stringify(old.record)) || old.version.canonicalMarkdownSha256 !== digest(old.canonicalMarkdown) || !consistentRecord(old.record) || !consistentEvents(old.record, historicalReport) || sixEditionMarkdown(old.record) !== old.canonicalMarkdown) throw new ObserverError("history-integrity-failed");
              for (const evidence of [...old.record.evidenceBundle.evidence.flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, ...evidence.origin }] : []), ...old.record.eventClusters.flatMap((cluster) => cluster.historyPolicies)]) {
                try {
                  const source = checkedPolicy(evidence);
                  if (!source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) withheldHistory.add(old.version.id);
                } catch { withheldHistory.add(old.version.id); }
              }
              return [old.record];
            });
            record = arrangeEvents(record as Parameters<typeof arrangeEvents>[0], research, history, legacyHistory, withheldHistory);
          } else record = arrangeEditions(record as Parameters<typeof arrangeEditions>[0], research);
        }
      } else {
        if (stories.some((story) => story.schemaVersion !== 1)) throw new ObserverError("agent-invalid-output");
        record = commonRecord as ReportRecord;
      }
      record = ReportRecordSchema.parse(record);
      if ((record.schemaVersion === 3 || record.schemaVersion === 4) && !consistentRecord(record)) throw new ObserverError("canonical-record-invalid");
      if (record.schemaVersion === 4 && !consistentEvents(record, historicalReport)) throw new ObserverError("canonical-event-record-invalid");
      const canonicalMarkdown = markdown(record);
      const report = PublishedReportSchema.parse({
        version: {
          schemaVersion: 1, id: `${request.businessDate}-v1`, briefId: request.businessDate,
          businessDate: request.businessDate, version: 1,
          publishedAtUtc,
          revisionReason: "initial", previousVersionId: null, provenance: "test-fixture",
          reportRecordId: record.id, canonicalMarkdownSha256: digest(canonicalMarkdown),
          ...(record.schemaVersion === 3 || record.schemaVersion === 4 ? { schemaVersion: record.schemaVersion === 4 ? 3 : 2, editorialContract: record.editorialContract, reportRecordSha256: digest(JSON.stringify(record)) } : {}),
        },
        record, canonicalMarkdown,
      });
      const insertion = database.prepare("INSERT INTO reports (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
        .run(report.version.id, JSON.stringify(report));
      if (insertion.changes === 0) throw new ObserverError("version-already-exists");
      return report.version;
    },
    readReport(versionId: string, credential: string | undefined): PublishedReport {
      if (!credential || !timingSafeEqual(Buffer.from(digest(credential)), Buffer.from(digest(options.ownerToken)))) {
        throw new ObserverError("unauthorized");
      }
      const row = database.prepare("SELECT payload FROM reports WHERE id = ?").get(versionId);
      if (!row) throw new ObserverError("not-found");
      const report = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
      if (options.mode === "production" && report.version.provenance === "test-fixture") throw new ObserverError("not-found");
      if (report.record.schemaVersion >= 3 || report.version.schemaVersion >= 2) {
        if ((report.record.schemaVersion !== 3 && report.record.schemaVersion !== 4) || (report.version.schemaVersion !== 2 && report.version.schemaVersion !== 3) || report.record.schemaVersion - 1 !== report.version.schemaVersion || report.record.editorialContract !== report.version.editorialContract || !consistentRecord(report.record) ||
          report.version.id !== versionId || report.version.id !== `${report.record.businessDate}-v1` || report.version.briefId !== report.record.businessDate ||
          report.record.id !== `${report.record.businessDate}-v1-record` || report.version.reportRecordId !== report.record.id ||
          report.version.businessDate !== report.record.businessDate || report.version.publishedAtUtc !== report.record.publicationGate.checkedAtUtc ||
          report.version.reportRecordSha256 !== digest(JSON.stringify(report.record)) || report.version.canonicalMarkdownSha256 !== digest(report.canonicalMarkdown) ||
          sixEditionMarkdown(report.record) !== report.canonicalMarkdown) throw new ObserverError("canonical-integrity-failed");
      }
      if (report.record.schemaVersion === 4 && !consistentEvents(report.record, historicalReport)) throw new ObserverError("canonical-integrity-failed");
      if (report.record.evidenceBundle.schemaVersion !== 1) {
        try {
          const identities = report.record.evidenceBundle.schemaVersion === 2 ? report.record.evidenceBundle.evidence : [...report.record.evidenceBundle.evidence.flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, ...evidence.origin }] : []), ...(report.record.schemaVersion === 4 ? report.record.eventClusters.flatMap((cluster) => cluster.historyPolicies) : [])];
          for (const evidence of identities) {
            const source = checkedPolicy(evidence);
            if (!source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) throw new Error("revoked");
          }
        } catch { throw new ObserverError("not-found"); }
      }
      return report;
    },
    close() { database.close(); },
  };
}
export type Observer = ReturnType<typeof createObserver>;
