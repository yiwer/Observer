import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AgentResultSchema, ProduceRequestSchema, PublishedReportSchema,
  editionNames, type AgentRunner, type PublishedReport, type ReportRecord,
} from "./contracts.ts";
import { SourcePolicySchema, policyDigest, sourceFields, type SourcePolicy } from "./collection.ts";
import type { Claim, SemanticVerifier } from "./gate-contracts.ts";
import { evaluatePublication, gatedMarkdown } from "./publication-gate.ts";

export class ObserverError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export interface ObserverOptions {
  databasePath: string;
  ownerToken: string;
  mode: "production" | "test-fixture";
  clock?: () => string;
  runner?: AgentRunner;
  sourcePolicies?: SourcePolicy[];
  verifier?: SemanticVerifier;
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function markdown(record: ReportRecord): string {
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

  return {
    async produce(input: unknown) {
      if (options.mode !== "test-fixture") throw new ObserverError("publication-disabled");
      if (!options.runner) throw new ObserverError("runner-unavailable");
      const parsedRequest = ProduceRequestSchema.safeParse(input);
      if (!parsedRequest.success) throw new ObserverError("invalid-request");
      const request = parsedRequest.data;
      const bundle = request.evidenceBundle;
      const modelRequest = structuredClone(request);
      if (!bundle.evidence.length) throw new ObserverError("evidence-unavailable");
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
      try { runnerOutput = await options.runner.run(structuredClone(modelRequest)); }
      catch { throw new ObserverError("agent-unknown"); }
      const parsedResult = AgentResultSchema.safeParse(runnerOutput);
      if (!parsedResult.success) throw new ObserverError("agent-invalid-output");
      const result = parsedResult.data;
      let publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
      if (result.provider !== "fixture" || result.startedAtUtc < bundle.cutoffUtc ||
        result.startedAtUtc > result.finishedAtUtc || result.finishedAtUtc > publishedAtUtc) {
        throw new ObserverError("invalid-fixture-run");
      }
      if (result.taskId !== request.taskId || result.evidenceBundleId !== request.evidenceBundle.id || result.configurationId !== request.configurationId) {
        throw new ObserverError("uncorrelated-agent-result");
      }
      if (result.status !== "succeeded") throw new ObserverError(`agent-${result.failure.category}`);
      if (options.verifier && result.stories.some((story) => story.schemaVersion === 1)) throw new ObserverError("legacy-candidate-disabled");
      const evidenceIds = new Set(request.evidenceBundle.evidence.map((evidence) => evidence.id));
      if (result.stories.some((story) => story.schemaVersion === 1 && story.claims.some((claim) => claim.evidenceIds.some((id) => !evidenceIds.has(id))))) {
        throw new ObserverError("unknown-evidence-reference");
      }
      if (result.stories.some((story) => story.schemaVersion === 1 && story.quotations?.some((quote) => !evidenceIds.has(quote.evidenceId)))) throw new ObserverError("unknown-evidence-reference");
      const gatedCandidates = result.stories.every((story) => story.schemaVersion === 2);
      if (bundle.schemaVersion === 2 && !gatedCandidates) {
        const quotationTotals = new Map<string, number>();
        for (const quotation of result.stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : [])) {
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
          const quotations = result.stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : []).filter((quote) => quote.evidenceId === evidence.id);
          const researchContent = modelRequest.evidenceBundle.evidence.find((item) => item.id === evidence.id)?.content;
          if (quotations.some((quote) => !evidence.content?.includes(quote.text) || !researchContent?.includes(quote.text))) throw new ObserverError("quotation-unverified");
          for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field)) delete evidence[field];
          // The mutable source cache is the only place that retains source body text.
          delete evidence.content;
          if (!evidence.url || !evidence.title) throw new ObserverError("citation-unavailable");
        }
      }
      const story = result.stories[0]!;
      const commonRecord = {
        schemaVersion: 1, id: `${request.businessDate}-v1-record`,
        businessDate: request.businessDate, businessTimezone: "Asia/Shanghai",
        configurationId: request.configurationId, taskId: request.taskId, applicationVersion: "0.1.0",
        evidenceBundle: request.evidenceBundle, stories: result.stories,
        coverageGaps: (Object.keys(editionNames) as Array<keyof typeof editionNames>)
          .filter((edition) => edition !== story.edition)
          .map((edition) => ({ edition, reason: "not-implemented-in-fixture-spine" })),
        sourcePolicyDecisions: bundle.schemaVersion === 1 ? bundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "test-fixture-only" })) : bundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "source-policy-v1", sourceId: evidence.sourceId, policyVersion: evidence.policyVersion, policySha256: evidence.policySha256, attribution: checkedPolicy(evidence).citation.attribution })),
        agentResult: result,
      };
      let record: ReportRecord;
      if (result.stories.every((story) => story.schemaVersion === 2)) {
        const quotationTotals = new Map<string, number>();
        for (const claim of result.stories.flatMap((story) => story.claims)) {
          if (claim.kind !== "quotation") continue;
          const evidence = bundle.evidence.find((item) => item.id === claim.evidenceIds[0]);
          if (!evidence) continue;
          quotationTotals.set(evidence.sourceId, (quotationTotals.get(evidence.sourceId) ?? 0) + [...claim.originalText].length + (claim.translated ? [...claim.text].length : 0));
        }
        const policyCheck = (ids: string[], claim: Claim): string | null => {
          if (bundle.schemaVersion === 1) return null;
          for (const id of ids) {
            const evidence = bundle.evidence.find((item) => item.id === id)!;
            let source: SourcePolicy;
            try { source = checkedPolicy(evidence); } catch { return "source-policy-invalid"; }
            if (evidence.sourceType !== source.sourceType) return "source-policy-invalid";
            if (evidence.expiresAtUtc <= (options.clock ?? (() => new Date().toISOString()))()) return "evidence-expired";
            if (!source.model.enabled) return "model-forbidden";
            if (!source.distribution.enabled || !source.distribution.allowDerivedText) return "distribution-forbidden";
            if (!source.distribution.allowPermanentArchive) return "archive-forbidden";
            if (!source.citation.enabled) return "citation-forbidden";
            if (claim.kind === "quotation" && (quotationTotals.get(source.sourceId) ?? 0) > source.citation.maxCharacters) return "citation-limit";
            if (!["url", "title"].every((field) => source.collection.fields.includes(field as "url" | "title") && source.storage.fields.includes(field as "url" | "title") && source.distribution.fields.includes(field as "url" | "title")) || !evidence.url || !evidence.title) return "citation-unavailable";
          }
          return null;
        };
        const gated = await evaluatePublication(modelRequest, result.stories, options.verifier, policyCheck);
        publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
        const eligibleIds = new Set(gated.stories.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)));
        // The input digest and permitted Evidence identities preserve review correlation without raw text.
        const archiveBundle = { ...bundle, schemaVersion: 2 as const, coverageGaps: [], evidence: bundle.evidence.filter((evidence) => eligibleIds.has(evidence.id)).map((evidence) => {
          const { content: _content, ...metadata } = structuredClone(evidence);
          if (bundle.schemaVersion === 2 && "policyVersion" in metadata) {
            const source = checkedPolicy(metadata);
            for (const field of sourceFields) if (field !== "content" && (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field))) delete metadata[field];
          }
          return bundle.schemaVersion === 2 ? metadata : { ...metadata, policyVersion: 1, policySha256: digest("test-fixture-only"), trust: "untrusted-source-data" as const, expiresAtUtc: publishedAtUtc };
        }) };
        const { stories: _stories, ...agentMetadata } = result;
        record = { ...commonRecord, schemaVersion: 2, evidenceBundle: archiveBundle, agentResult: agentMetadata, ...gated,
          sourcePolicyDecisions: commonRecord.sourcePolicyDecisions.filter((decision) => eligibleIds.has(decision.evidenceId)),
          coverageGaps: Object.keys(editionNames).filter((edition) => !gated.stories.some((story) => story.edition === edition)).map((edition) => ({ edition, reason: "no-publishable-claims" })),
        } as ReportRecord;
      } else {
        if (result.stories.some((story) => story.schemaVersion !== 1)) throw new ObserverError("agent-invalid-output");
        record = commonRecord as ReportRecord;
      }
      const canonicalMarkdown = markdown(record);
      const report = PublishedReportSchema.parse({
        version: {
          schemaVersion: 1, id: `${request.businessDate}-v1`, briefId: request.businessDate,
          businessDate: request.businessDate, version: 1,
          publishedAtUtc,
          revisionReason: "initial", previousVersionId: null, provenance: "test-fixture",
          reportRecordId: record.id, canonicalMarkdownSha256: digest(canonicalMarkdown),
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
      if (report.record.evidenceBundle.schemaVersion === 2) {
        try {
          for (const evidence of report.record.evidenceBundle.evidence) {
            if (report.record.schemaVersion === 2 && report.record.sourcePolicyDecisions.some((decision) => decision.evidenceId === evidence.id && decision.decision === "test-fixture-only")) continue;
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
