import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AgentResultSchema, ProduceRequestSchema, PublishedReportSchema,
  editionNames, type AgentRunner, type PublishedReport, type ReportRecord,
} from "./contracts.ts";

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
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function markdown(record: ReportRecord): string {
  const story = record.stories[0]!;
  const overview = Object.entries(editionNames).map(([edition, label]) =>
    `- ${label}：${edition === story.edition ? story.title : "Coverage Gap（本票尚未实现该栏）"}`,
  );
  const claims = story.claims.map((claim) => `${claim.text}\n\n${claim.evidenceIds.map((evidenceId) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === evidenceId)!;
    return `来源：[${evidence.title}](${evidence.url}) [${evidence.id}]`;
  }).join("\n\n")}`);
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    "> 自动化测试固定替身产物；未经过真实研究或生产准入。",
    "## Today Overview", overview.join("\n"),
    `## ${editionNames[story.edition]}`, `### ${story.title}`, ...claims,
  ].join("\n\n") + "\n";
}

export function createObserver(options: ObserverOptions) {
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
      if (bundle.businessDate !== request.businessDate || bundle.configurationId !== request.configurationId ||
        new Set(bundle.evidence.map((evidence) => evidence.id)).size !== bundle.evidence.length) {
        throw new ObserverError("invalid-bundle-identity");
      }
      if (bundle.windowStartUtc >= bundle.cutoffUtc || bundle.evidence.some((evidence) =>
        evidence.discoveredAtUtc > evidence.retrievedAtUtc || evidence.retrievedAtUtc > bundle.cutoffUtc ||
        (evidence.publishedAtUtc !== null && evidence.publishedAtUtc > bundle.cutoffUtc))) {
        throw new ObserverError("invalid-evidence-window");
      }
      if (request.evidenceBundle.evidence.some((evidence) => digest(evidence.content) !== evidence.contentSha256)) {
        throw new ObserverError("evidence-integrity-failed");
      }
      let runnerOutput: unknown;
      try { runnerOutput = await options.runner.run(structuredClone(request)); }
      catch { throw new ObserverError("agent-unknown"); }
      const parsedResult = AgentResultSchema.safeParse(runnerOutput);
      if (!parsedResult.success) throw new ObserverError("agent-invalid-output");
      const result = parsedResult.data;
      const publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
      if (result.provider !== "fixture" || result.startedAtUtc < bundle.cutoffUtc ||
        result.startedAtUtc > result.finishedAtUtc || result.finishedAtUtc > publishedAtUtc) {
        throw new ObserverError("invalid-fixture-run");
      }
      if (result.taskId !== request.taskId || result.evidenceBundleId !== request.evidenceBundle.id || result.configurationId !== request.configurationId) {
        throw new ObserverError("uncorrelated-agent-result");
      }
      if (result.status !== "succeeded") throw new ObserverError(`agent-${result.failure.category}`);
      const evidenceIds = new Set(request.evidenceBundle.evidence.map((evidence) => evidence.id));
      if (result.stories.some((story) => story.claims.some((claim) => claim.evidenceIds.some((id) => !evidenceIds.has(id))))) {
        throw new ObserverError("unknown-evidence-reference");
      }
      const story = result.stories[0]!;
      const record: ReportRecord = {
        schemaVersion: 1, id: `${request.businessDate}-v1-record`,
        businessDate: request.businessDate, businessTimezone: "Asia/Shanghai",
        configurationId: request.configurationId, taskId: request.taskId, applicationVersion: "0.1.0",
        evidenceBundle: request.evidenceBundle, stories: result.stories,
        coverageGaps: (Object.keys(editionNames) as Array<keyof typeof editionNames>)
          .filter((edition) => edition !== story.edition)
          .map((edition) => ({ edition, reason: "not-implemented-in-fixture-spine" })),
        sourcePolicyDecisions: request.evidenceBundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "test-fixture-only" })),
        agentResult: result,
      };
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
      return report;
    },
    close() { database.close(); },
  };
}
export type Observer = ReturnType<typeof createObserver>;
