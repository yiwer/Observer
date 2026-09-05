import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createCollection, type SourcePolicy } from "../src/collection.ts";
import { createObserver } from "../src/observer.ts";
import { clock, ownerToken, request, successfulResult } from "./fixtures.ts";

import { policy } from "./helpers/source-fixtures.ts";

async function setup(t: TestContext, sources = [policy()], read?: (url: string) => Promise<{ status: number; body: string; headers: Record<string, string> }>) {
  const directory = await mkdtemp(join(tmpdir(), "observer-collection-"));
  const collection = createCollection({ databasePath: join(directory, "collection.sqlite"), sources, clock: () => "2026-09-04T22:06:00.000Z", ...(read ? { read } : {}) });
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  return collection;
}

test("Unreviewed sources stay visible as Proposals and an Agent proposal never enables collection", async (t) => {
  const pending = policy(); pending.review.status = "pending";
  const collection = await setup(t, [pending], async () => ({ status: 200, body: rss, headers: {} }));
  collection.proposeSource({ sourceId: "agent-found", feedUrl: "https://other.example/feed", reason: "Possible source" });
  const result = await collection.collect();
  assert.deepEqual(result.coverageGaps.map((gap) => gap.reason), ["source-pending"]);
  assert.deepEqual(collection.status().proposals.map((proposal) => proposal.sourceId), ["owner-test", "agent-found"]);
  assert.equal(result.added, 0);
  assert.equal(collection.bundle(window, "model").evidence.length, 0);
});

test("Incremental polling preserves identity and first discovery, reports duplicates and updates Atom content", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-incremental-"));
  let now = "2026-09-04T22:06:00.000Z";
  let body = rss;
  const options = { databasePath: join(directory, "collection.sqlite"), sources: [policy()], clock: () => now, read: async () => ({ status: 200, body, headers: { etag: "revision-1" } }) };
  let collection = createCollection(options);
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  await collection.collect();
  const first = collection.bundle(window, "storage").evidence[0]!;
  assert.equal((await collection.collect()).outcomes[0]?.reason, "poll-not-due");
  now = "2026-09-04T22:07:00.000Z";
  assert.equal((await collection.collect()).duplicates, 1);
  assert.equal(collection.status().outcomes[0]?.reason, "no-change");
  assert.equal(collection.status().coverageGaps.length, 0);
  collection.close();
  collection = createCollection(options);
  now = "2026-09-04T22:08:00.000Z";
  body = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title><entry><id>item-42</id><title>تحديث観測</title><link href="https://source.example/item-42"/><updated>2026-09-04T22:07:00Z</updated><content>新增 14 个观测点。</content></entry></feed>`;
  assert.equal((await collection.collect()).updated, 1);
  const changed = collection.bundle(window, "model").evidence[0]!;
  assert.equal(changed.id, first.id);
  assert.equal(changed.discoveredAtUtc, first.discoveredAtUtc);
  assert.equal(changed.retrievedAtUtc, now);
  assert.equal(changed.publishedAtUtc, null);
  assert.equal(changed.publishedAtRaw, null);
  assert.equal(changed.title, "تحديث観測");
  assert.equal(changed.content, "新增 14 个观测点。");
  assert.equal(collection.bundle(window, "model").evidence.length, 1);
});

const window = { businessDate: "2026-09-05", configurationId: "collection-v1", windowStartUtc: "2026-09-03T23:30:00.000Z", cutoffUtc: "2026-09-04T23:30:00.000Z" };
const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Owner fixture</title><item><guid>item-42</guid><title>観測更新：新增 12 个观测点</title><link>https://source.example/item-42</link><pubDate>Fri, 04 Sep 2026 22:00:00 GMT</pubDate><description>新增 12 个观测点。</description></item></channel></rss>`;

test("Approved RSS creates a multilingual, source-timed Evidence Bundle from permitted fields", async (t) => {
  const collection = await setup(t, [policy()], async () => ({ status: 200, body: rss, headers: {} }));
  assert.equal((await collection.collect()).added, 1);
  const bundle = collection.bundle(window, "model");
  assert.equal(bundle.schemaVersion, 2);
  assert.equal(bundle.evidence[0]?.title, "観測更新：新增 12 个观测点");
  assert.equal(bundle.evidence[0]?.publishedAtRaw, "Fri, 04 Sep 2026 22:00:00 GMT");
  assert.equal(bundle.evidence[0]?.publishedAtUtc, "2026-09-04T22:00:00.000Z");
  assert.equal(bundle.evidence[0]?.eventTimeUtc, null);
  assert.equal(bundle.evidence[0]?.discoveredAtUtc, "2026-09-04T22:06:00.000Z");
  assert.equal(bundle.evidence[0]?.retrievedAtUtc, "2026-09-04T22:06:00.000Z");
  assert.equal(bundle.evidence[0]?.content, "新增 12 个观测点。");
  assert.equal(bundle.evidence[0]?.trust, "untrusted-source-data");
});

test("Collection, storage and model denials independently constrain the next business stage and TTL removes retained material", async (t) => {
  const forbidden = policy(); forbidden.collection.enabled = false;
  const noStore = policy(); noStore.storage.fields = []; noStore.storage.retainRecordKeys = false;
  const noModel = policy(); noModel.model.enabled = false;
  const hashOnly = policy(); hashOnly.storage.fields = ["url", "title", "contentSha256"];
  hashOnly.model.fields = ["url", "title"];
  for (const [source, reason] of [[forbidden, "collection-forbidden"], [noStore, "storage-forbidden"], [noModel, "model-forbidden"]] as const) {
    const collection = await setup(t, [source], async () => ({ status: 200, body: rss, headers: {} }));
    await collection.collect();
    const bundle = collection.bundle(window, "model");
    assert.equal(bundle.evidence.length, 0);
    assert.ok(bundle.coverageGaps.some((gap) => gap.reason === reason));
    if (reason === "storage-forbidden") assert.equal(collection.bundle(window, "storage").evidence.length, 0);
    if (reason === "model-forbidden") assert.equal(collection.bundle(window, "storage").evidence[0]?.content, "新增 12 个观测点。");
  }
  const directory = await mkdtemp(join(tmpdir(), "observer-retention-"));
  let now = "2026-09-04T22:06:00.000Z";
  const collection = createCollection({ databasePath: join(directory, "collection.sqlite"), sources: [hashOnly], clock: () => now, read: async () => ({ status: 200, body: rss, headers: {} }) });
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  await collection.collect();
  assert.equal(collection.bundle(window, "storage").evidence[0]?.content, undefined);
  assert.match(collection.bundle(window, "storage").evidence[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  assert.equal(collection.bundle(window, "model").evidence[0]?.contentSha256, undefined);
  now = "2026-09-05T22:06:00.000Z";
  assert.equal(collection.bundle(window, "storage").evidence.length, 0);
  assert.ok(collection.bundle(window, "model").coverageGaps.some((gap) => gap.reason === "evidence-unavailable"));
});

test("A timed out or rate limited source leaves a visible Gap while another source contributes evidence; Retry-After and 304 are observed", async (t) => {
  const slow = policy(); slow.sourceId = "slow"; slow.feedUrl = "https://slow.example/feed"; slow.limits.timeoutMs = 20;
  const limited = policy(); limited.sourceId = "limited"; limited.feedUrl = "https://limited.example/feed";
  const good = policy();
  let now = "2026-09-04T22:06:00.000Z";
  let status = 200;
  const directory = await mkdtemp(join(tmpdir(), "observer-retry-"));
  const collection = createCollection({
    databasePath: join(directory, "collection.sqlite"), sources: [slow, limited, good], clock: () => now,
    read: async (url) => url.includes("slow.") ? new Promise(() => {}) : url.includes("limited.") ? { status: 429, body: "PRIVATE ERROR", headers: { "retry-after": "120" } } : { status, body: rss, headers: { etag: "first" } },
  });
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  const first = await collection.collect();
  assert.equal(first.added, 1);
  assert.deepEqual(first.coverageGaps.map((gap) => gap.reason), ["timeout", "rate-limited"]);
  assert.equal(collection.bundle(window, "model").evidence.length, 1);
  now = "2026-09-04T22:07:00.000Z"; status = 304;
  const second = await collection.collect();
  assert.ok(second.outcomes.some((outcome) => outcome.sourceId === "limited" && outcome.reason === "poll-not-due"));
  assert.ok(second.outcomes.some((outcome) => outcome.sourceId === "owner-test" && outcome.reason === "not-modified"));
  assert.equal(collection.bundle(window, "model").evidence.length, 1);
  assert.equal(JSON.stringify(collection.status()).includes("PRIVATE ERROR"), false);
});

test("Public production sends only permitted fields to research and refuses distribution or permanent-archive bans", async (t) => {
  for (const denial of ["none", "model", "distribution", "archive"] as const) {
    const source = policy();
    source.model.fields = ["url", "title", "contentSha256"];
    if (denial === "model") source.model.enabled = false;
    if (denial === "distribution") source.distribution.enabled = false;
    if (denial === "archive") source.distribution.allowPermanentArchive = false;
    const collection = await setup(t, [source], async () => ({ status: 200, body: rss, headers: {} }));
    await collection.collect();
    const bundle = collection.bundle(window, "storage");
    const directory = await mkdtemp(join(tmpdir(), "observer-policy-publication-"));
    const observer = createObserver({ databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture", clock, sourcePolicies: [source], runner: {
      run: async (task) => {
        const output = successfulResult(); output.evidenceBundleId = bundle.id; output.configurationId = window.configurationId;
        output.stories[0]!.title = "允许的标题";
        output.stories[0]!.claims = [{ text: task.evidenceBundle.evidence[0]?.content ? "LEAKED FULLTEXT" : "Only permitted metadata was available", evidenceIds: [bundle.evidence[0]!.id] }];
        return output;
      },
    } });
    t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
    const input = { ...request, configurationId: window.configurationId, evidenceBundle: bundle };
    if (denial === "none") {
      const version = await observer.produce(input);
      const report = observer.readReport(version.id, ownerToken);
      assert.match(report.canonicalMarkdown, /Only permitted metadata was available/);
      assert.equal(JSON.stringify(report).includes("新增 12 个观测点。"), false);
      assert.equal(report.record.sourcePolicyDecisions[0]?.decision, "source-policy-v1");
    } else {
      await assert.rejects(observer.produce(input), { code: `${denial}-forbidden` });
      assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
    }
  }
});

test("Full text may inform original research while citations and archives receive their separate permitted metadata", async (t) => {
  const source = policy();
  source.model.fields = ["content", "contentSha256"];
  source.distribution.fields = ["url", "title", "contentSha256"];
  source.citation.maxCharacters = 0;
  const collection = await setup(t, [source], async () => ({ status: 200, body: rss, headers: {} }));
  await collection.collect(); const bundle = collection.bundle(window, "storage");
  const directory = await mkdtemp(join(tmpdir(), "observer-derived-"));
  const observer = createObserver({ databasePath: join(directory, "archive.sqlite"), mode: "test-fixture", ownerToken, clock, sourcePolicies: [source], runner: { run: async (task) => {
    const output = successfulResult(); output.evidenceBundleId = bundle.id; output.configurationId = window.configurationId;
    output.stories[0]!.claims = [{ text: task.evidenceBundle.evidence[0]?.content === "新增 12 个观测点。" && task.evidenceBundle.evidence[0]?.title === undefined ? "Original interpretation from permitted research" : "WRONG INPUT", evidenceIds: [bundle.evidence[0]!.id] }];
    return output;
  } } });
  t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
  const version = await observer.produce({ ...request, configurationId: window.configurationId, evidenceBundle: bundle });
  const report = observer.readReport(version.id, ownerToken);
  assert.match(report.canonicalMarkdown, /Original interpretation from permitted research/);
  assert.match(report.canonicalMarkdown, /Owner test observatory/);
  assert.equal(JSON.stringify(report).includes("新增 12 个观测点。"), false);
  assert.equal(report.record.evidenceBundle.evidence[0]?.title, "観測更新：新增 12 个观测点");
});

test("Owner configuration versions revoke old cache and persist proposals; conditional polling survives restart without renewing raw TTL", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-source-policy-"));
  const path = join(directory, "collection.sqlite");
  let now = "2026-09-04T22:06:00.000Z";
  let collection = createCollection({ databasePath: path, sources: [policy()], clock: () => now, read: async () => ({ status: 200, body: rss, headers: { etag: "version-1" } }) });
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  await collection.collect();
  collection.proposeSource({ sourceId: "discovery", feedUrl: "https://new.example/feed", reason: "Needs review" });
  collection.close();
  now = "2026-09-04T22:07:00.000Z";
  collection = createCollection({ databasePath: path, sources: [policy()], clock: () => now, read: async (_url, input) => input.headers["if-none-match"] === "version-1" ? { status: 304, body: "", headers: {} } : { status: 200, body: rss.replace("12", "99"), headers: {} } });
  assert.equal((await collection.collect()).outcomes[0]?.reason, "not-modified");
  assert.equal(collection.bundle(window, "storage").evidence[0]?.expiresAtUtc, "2026-09-05T22:06:00.000Z");
  assert.equal(collection.status().proposals[0]?.sourceId, "discovery");
  collection.close();
  const changed = policy(); changed.storage.fields = ["url", "title"];
  assert.throws(() => createCollection({ databasePath: path, sources: [changed] }), /policy-version-conflict/);
  changed.version = 2;
  collection = createCollection({ databasePath: path, sources: [changed], clock: () => now });
  assert.equal(collection.bundle(window, "storage").evidence.length, 0);
  collection.close();
  collection = createCollection({ databasePath: path, sources: [], clock: () => now });
  assert.equal(collection.bundle(window, "storage").evidence.length, 0);
});

test("Atom relative links and unknown publication times survive, while invalid XML, excessive items and oversized feeds cannot become evidence", async (t) => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://source.example/news/"><entry><id>relative</id><title>多言語</title><link href="entry-1"/><published>2026-09-04 22:00:00</published><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">首段 <b>続き</b></div></content></entry></feed>`;
  const collection = await setup(t, [policy()], async () => ({ status: 200, body: atom, headers: {} }));
  await collection.collect(); const evidence = collection.bundle(window, "model").evidence[0]!;
  assert.equal(evidence.url, "https://source.example/news/entry-1");
  assert.equal(evidence.publishedAtRaw, "2026-09-04 22:00:00");
  assert.equal(evidence.publishedAtUtc, null);
  assert.equal(evidence.content, "首段 続き");
  for (const body of ["<not-a-feed><item><title>bad</title></item></not-a-feed>", rss + "broken", rss.repeat(1000), rss.replace("</channel>", "<item><title>extra</title></item></channel>")]) {
    const source = policy(); source.limits.maxItems = 1;
    const rejected = await setup(t, [source], async () => ({ status: 200, body, headers: {} }));
    const result = await rejected.collect();
    assert.equal(result.added, 0);
    assert.ok(result.coverageGaps.length > 0);
    assert.equal(rejected.bundle(window, "model").evidence.length, 0);
  }
});

test("Explicit quotations need source support and a citation grant; revoked configuration cannot serve an archived collected report", async (t) => {
  const source = policy(); source.distribution.fields = ["url", "title", "contentSha256"];
  source.citation.maxCharacters = 5;
  const collection = await setup(t, [source], async () => ({ status: 200, body: rss, headers: {} }));
  await collection.collect(); const bundle = collection.bundle(window, "storage");
  const directory = await mkdtemp(join(tmpdir(), "observer-quotation-"));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  for (const [quotation, code] of [["12 个", undefined], ["新增 12 个观测点。", "citation-limit"], ["不存在", "quotation-unverified"]] as const) {
    const databasePath = join(directory, `archive-${code ?? "ok"}.sqlite`);
    const observer = createObserver({ databasePath, ownerToken, mode: "test-fixture", clock, sourcePolicies: [source], runner: { run: async () => {
      const output = successfulResult(); output.evidenceBundleId = bundle.id; output.configurationId = window.configurationId;
      return { ...output, stories: [{ ...output.stories[0], claims: [{ text: "Original observation", evidenceIds: [bundle.evidence[0]!.id] }], quotations: [{ evidenceId: bundle.evidence[0]!.id, text: quotation }] }] };
    } } });
    try {
      const input = { ...request, configurationId: window.configurationId, evidenceBundle: bundle };
      if (code) await assert.rejects(observer.produce(input), { code });
      else { const version = await observer.produce(input); assert.match(observer.readReport(version.id, ownerToken).canonicalMarkdown, /引文.*12 个/); }
    } finally { observer.close(); }
    if (!code) {
      const revoked = createObserver({ databasePath, ownerToken, mode: "test-fixture", clock, sourcePolicies: [] });
      try { assert.throws(() => revoked.readReport("2026-09-05-v1", ownerToken), { code: "not-found" }); } finally { revoked.close(); }
    }
  }
});

test("A body received after cutoff cannot inherit its earlier poll start or feed discovery time", async (t) => {
  const source = policy(); source.collection.readBody = true;
  const directory = await mkdtemp(join(tmpdir(), "observer-cutoff-"));
  let now = "2026-09-04T23:29:55.000Z";
  const collection = createCollection({ databasePath: join(directory, "collection.sqlite"), sources: [source], clock: () => now, read: async (url) => {
    now = url.endsWith("/feed") ? "2026-09-04T23:29:59.000Z" : "2026-09-04T23:30:15.000Z";
    return { status: 200, body: url.endsWith("/feed") ? rss : "正文在截止后才返回", headers: {} };
  } });
  t.after(async () => { collection.close(); await rm(directory, { recursive: true, force: true }); });
  await collection.collect();
  assert.equal(collection.bundle(window, "model").evidence.length, 0);
  const nextWindow = { ...window, cutoffUtc: "2026-09-05T23:30:00.000Z" };
  const evidence = collection.bundle(nextWindow, "storage").evidence[0]!;
  assert.equal(evidence.discoveredAtUtc, "2026-09-04T23:29:59.000Z");
  assert.equal(evidence.retrievedAtUtc, "2026-09-04T23:30:15.000Z");
});

test("Invalid calendar dates retain the publisher's raw value without inventing a normalized publication time", async (t) => {
  const body = rss.replace("Fri, 04 Sep 2026 22:00:00 GMT", "Mon, 30 Feb 2026 10:00:00 GMT");
  const collection = await setup(t, [policy()], async () => ({ status: 200, body, headers: {} }));
  await collection.collect(); const evidence = collection.bundle(window, "model").evidence[0]!;
  assert.equal(evidence.publishedAtRaw, "Mon, 30 Feb 2026 10:00:00 GMT");
  assert.equal(evidence.publishedAtUtc, null);
});
