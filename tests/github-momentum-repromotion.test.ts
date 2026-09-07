import assert from "node:assert/strict";
import { test } from "node:test";
import { SourcePolicySchema } from "../src/collection.ts";
import { repromotionFixture, ownedRelease } from "./helpers/repromotion-fixtures.ts";
import { repository } from "./helpers/github-fixtures.ts";
import { ownerToken } from "./fixtures.ts";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { rankGitHubRepromotions, githubRepromotionMarkdown } from "../src/github-repromotion.ts";
import { editionNames, PublishedReportSchema } from "../src/contracts.ts";

test("An explicitly permitted first exceptional momentum observation restores only recovery and publishes its real startup proof after restart", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  let semanticCalls = 0;
  fixture.state.assess = async () => { semanticCalls++; return null; };
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (exceptional: boolean) => [repository("repeat", exceptional ? 200 : 100, exceptional ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${String(i).padStart(2, "0")}`, exceptional ? 1 : 0, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(false));
  const previous = await fixture.publish("2026-09-05", 8);
  if (previous.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(previous.record.githubRanking.selectedNodeIds, ["repeat"]);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour === 24));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(semanticCalls, 0, "raw momentum does not use a materiality model");
  assert.ok(report.record.githubRepromotion.selectedNodeIds.includes("repeat"));
  const repeat = report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(repeat.recoveryMultiplier, 0);
  assert.equal(repeat.effectiveRecoveryMultiplier, 1);
  assert.ok(repeat.frequencyMultiplier < 1);
  assert.ok(report.record.githubRepromotion.quota.selectedNovel >= Math.ceil(report.record.githubRepromotion.quota.actual / 2));
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  assert.match(report.canonicalMarkdown, /observer-github-momentum-v1/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A current momentum proof must authenticate its historical raw endpoint even when that endpoint is newer than the saved onset capsule", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour < 24 ? 100 : 200 + Math.floor((hour - 24) * 100 / 24), 20 + Math.floor(hour / 24) * 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${String(i).padStart(2, "0")}`, Math.floor(hour / 24), 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  await fixture.publish("2026-09-05", 8);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const onset = await fixture.publish("2026-09-06");
  if (onset.record.schemaVersion !== 10) throw new Error("Record10 required");
  const originalId = onset.record.githubRepromotion.reportedDevelopments[0]!.developmentId;
  for (let hour = 25; hour <= 72; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubDevelopments.momentum!.developments[0]!.developmentId, originalId);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  const endpoint = report.record.githubDevelopments.momentum!.point!.candidates.find((entry) => entry.nodeId === "repeat")!.historical!;
  assert.ok(endpoint.slot > onset.record.githubDevelopments.momentum!.capsules[0]!.points.at(-1)!.slot);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT payload,momentum_payload_bytes,momentum_payload_sha256 FROM runs WHERE slot=?").get(endpoint.slot)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_raw_update'").get()!.sql);
  const altered = JSON.parse(String(original.payload));
  altered.observations = altered.observations.filter((entry: { nodeId: string }) => entry.nodeId !== "repeat");
  const raw = JSON.stringify(altered);
  try {
    // Fault injection restores the exact guard before the public read. The
    // route, JSON digest and remaining observations are internally consistent;
    // the referenced historical observation is absent from its actual parent.
    fault.exec("DROP TRIGGER momentum_raw_update");
    fault.prepare("UPDATE runs SET payload=?,momentum_payload_bytes=?,momentum_payload_sha256=? WHERE slot=?")
      .run(raw, Buffer.byteLength(raw), createHash("sha256").update(raw).digest("hex"), endpoint.slot);
    fault.exec(guard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.exec("DROP TRIGGER momentum_raw_update");
    fault.prepare("UPDATE runs SET payload=?,momentum_payload_bytes=?,momentum_payload_sha256=? WHERE slot=?")
      .run(original.payload!, original.momentum_payload_bytes!, original.momentum_payload_sha256!, endpoint.slot);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A single authenticated read shares its actual payload cap between momentum frames and their original development risk witnesses", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const slot = report.record.githubDevelopments.runs[0]!.slot;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT payload,payload_bytes,payload_sha256 FROM development_runs WHERE slot=?").get(slot)!;
  const frames = fault.prepare("SELECT slot,payload,payload_bytes,payload_sha256 FROM momentum_frames ORDER BY slot").all();
  const developmentGuard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='context_raw_update'").get()!.sql);
  const frameGuard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_frames_update_guard'").get()!.sql);
  const developmentBytes = 31 * 1024 * 1024, frameBytes = 1536 * 1024;
  assert.equal(frames.length, 25);
  assert.ok(developmentBytes + frames.length * frameBytes > 64 * 1024 * 1024);
  const pad = (raw: unknown, bytes: number) => String(raw) + " ".repeat(bytes - Buffer.byteLength(String(raw)));
  const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");
  try {
    // Valid JSON whitespace preserves every field and the original receipt
    // identities. Each individual row stays inside its approved hard cap.
    fault.exec("DROP TRIGGER context_raw_update");
    const largeDevelopment = pad(original.payload, developmentBytes);
    fault.prepare("UPDATE development_runs SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?").run(largeDevelopment, developmentBytes, sha(largeDevelopment), slot);
    fault.exec(developmentGuard);
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    for (const entry of frames) { const raw = pad(entry.payload, frameBytes); fault.prepare("UPDATE momentum_frames SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?").run(raw, frameBytes, sha(raw), entry.slot!); }
    fault.exec(frameGuard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.exec("DROP TRIGGER context_raw_update");
    fault.prepare("UPDATE development_runs SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?").run(original.payload!, original.payload_bytes!, original.payload_sha256!, slot);
    fault.exec(developmentGuard);
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    for (const entry of frames) fault.prepare("UPDATE momentum_frames SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?").run(entry.payload!, entry.payload_bytes!, entry.payload_sha256!, entry.slot!);
    fault.exec(frameGuard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A complete real 24 hour non-extreme interval and its adjacent new high rearm momentum with a new onset while preserving published history", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour < 24 ? 100 : hour < 73 ? 200 : 300, hour < 24 ? 20 : hour < 73 ? 40 : 60),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${String(i).padStart(2, "0")}`, Math.floor(hour / 24), 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  await fixture.publish("2026-09-05", 8);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const firstDevelopment = first.record.githubRepromotion.reportedDevelopments.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(firstDevelopment.kind, "momentum");
  for (let hour = 25; hour <= 72; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const low = fixture.observations.repromotionSnapshot!(new Date(start + 72 * 3600000 + 300000).toISOString());
  assert.equal(low.developments.momentum!.nodes.find((entry) => entry.nodeId === "repeat")!.status, "non-extreme");
  assert.deepEqual(low.developments.momentum!.developments, []);
  for (let hour = 73; hour <= 96; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const next = await fixture.publish("2026-09-09");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  const secondDevelopment = next.record.githubRepromotion.reportedDevelopments.find((entry) => entry.nodeId === "repeat");
  assert.ok(secondDevelopment, "a genuinely new, fully reset episode can be reported during ordinary cooldown");
  assert.equal(secondDevelopment.kind, "momentum");
  assert.notEqual(secondDevelopment.developmentId, firstDevelopment.developmentId);
  assert.notEqual(secondDevelopment.observationId, firstDevelopment.observationId);
  const capsule = next.record.githubDevelopments.momentum!.capsules.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(capsule.kind, "reset");
  assert.equal(capsule.points.length, 26);
  assert.equal(capsule.points[0]!.slot, new Date(start + 48 * 3600000).toISOString());
  assert.equal(capsule.points.at(-2)!.slot, new Date(start + 72 * 3600000).toISOString());
  assert.equal(capsule.points.at(-1)!.slot, new Date(start + 73 * 3600000).toISOString());
  const repeat = next.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(repeat.recoveryMultiplier, 0);
  assert.equal(repeat.effectiveRecoveryMultiplier, 1);
  assert.ok(repeat.frequencyMultiplier < 1);
  assert.ok(next.record.githubRepromotion.quota.selectedNovel >= Math.ceil(next.record.githubRepromotion.quota.actual / 2));
  assert.match(next.canonicalMarkdown, /reset证明 26 个评估点/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(first.version.id, ownerToken), first);
  assert.deepEqual(fixture.observer.readReport(next.version.id, ownerToken), next);
});

test("A public repromotion snapshot with a missing historical raw member withholds momentum while retaining ordinary evidence", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 72; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour < 24 ? 100 : 200 + Math.floor((hour - 24) * 100 / 24), 20 + Math.floor(hour / 24) * 20),
      ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, Math.floor(hour / 24), 0))]);
  const cutoff = new Date(start + 72 * 3600000 + 300000).toISOString();
  const before = fixture.observations.repromotionSnapshot!(cutoff);
  assert.equal(before.developments.momentum!.developments.length, 1);
  const endpoint = before.developments.momentum!.point!.candidates.find((entry) => entry.nodeId === "repeat")!.historical!;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT payload,momentum_payload_bytes,momentum_payload_sha256 FROM runs WHERE slot=?").get(endpoint.slot)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_raw_update'").get()!.sql);
  const altered = JSON.parse(String(original.payload));
  altered.observations = altered.observations.filter((entry: { nodeId: string }) => entry.nodeId !== "repeat");
  const raw = JSON.stringify(altered);
  try {
    fault.exec("DROP TRIGGER momentum_raw_update");
    fault.prepare("UPDATE runs SET payload=?,momentum_payload_bytes=?,momentum_payload_sha256=? WHERE slot=?")
      .run(raw, Buffer.byteLength(raw), createHash("sha256").update(raw).digest("hex"), endpoint.slot);
    fault.exec(guard);
    const after = fixture.observations.repromotionSnapshot!(cutoff);
    assert.equal(after.developments.momentum?.developments.length ?? 0, 0, "unverified original membership cannot provide a public momentum proof");
    assert.ok([...after.developments.reasons, ...(after.developments.momentum?.reasons ?? [])].some((reason) => /momentum.*unavailable/.test(reason)));
    assert.equal(after.github.watchItems.length, 20);
    assert.equal(after.developments.runs.length, before.developments.runs.length);
  } finally {
    fault.exec("DROP TRIGGER momentum_raw_update");
    fault.prepare("UPDATE runs SET payload=?,momentum_payload_bytes=?,momentum_payload_sha256=? WHERE slot=?")
      .run(original.payload!, original.momentum_payload_bytes!, original.momentum_payload_sha256!, endpoint.slot);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observations.repromotionSnapshot!(cutoff), before);
});

test("A canonical but incomplete momentum dependency header cannot authorize an otherwise unchanged published proof", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const slot = report.record.githubDevelopments.momentum!.point!.slot;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT dependency_policies FROM momentum_frames WHERE slot=?").get(slot)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_frames_update_guard'").get()!.sql);
  try {
    // Only the actual routing header is damaged. Every payload, content hash,
    // endpoint, reported identity and current source permission stays intact.
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    fault.prepare("UPDATE momentum_frames SET dependency_policies='[]' WHERE slot=?").run(slot);
    fault.exec(guard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    fault.prepare("UPDATE momentum_frames SET dependency_policies=? WHERE slot=?").run(original.dependency_policies!, slot);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Saved momentum inputs cannot relabel an actually enabled advisory witness as disabled", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const snapshot = { schemaVersion: 1 as const, github: report.record.github, developments: report.record.githubDevelopments };
  const context = { interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history,
    eventHistory: report.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" as const };
  assert.deepEqual(rankGitHubRepromotions({ snapshot, ...context }), report.record.githubRepromotion);
  const altered = structuredClone(snapshot), momentum = altered.developments.momentum!, capsule = momentum.capsules[0]!;
  const firstPoint = capsule.points[0]!;
  assert.equal(firstPoint.security.mode, "observed");
  assert.equal(firstPoint.developmentConfiguration!.advisories, true);
  firstPoint.security = { mode: "disabled", origin: firstPoint.security.origin };
  // These are caller-owned saved inputs. Recompute their declared content
  // identifiers to isolate the false disabled claim from a trivial hash error.
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const { id: _pointId, ...pointContent } = firstPoint;
  firstPoint.id = digest(pointContent);
  const originalCapsuleId = capsule.id, { id: _capsuleId, ...capsuleContent } = capsule;
  capsule.id = digest(capsuleContent);
  for (const node of momentum.nodes) if (node.capsuleId === originalCapsuleId) node.capsuleId = capsule.id;
  for (const development of momentum.developments) if (development.capsuleId === originalCapsuleId) development.capsuleId = capsule.id;
  assert.throws(() => rankGitHubRepromotions({ snapshot: altered, ...context }), /proof-invalid|input-invalid/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Saved momentum inputs must retain the complete observed security pool including peers with no known advisory", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  const snapshot = { schemaVersion: 1 as const, github: report.record.github, developments: report.record.githubDevelopments };
  const context = { interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history,
    eventHistory: report.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" as const };
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  assert.deepEqual(rankGitHubRepromotions({ snapshot, ...context }), report.record.githubRepromotion);
  const altered = structuredClone(snapshot), momentum = altered.developments.momentum!, capsule = momentum.capsules[0]!, point = capsule.points[0]!;
  if (point.security.mode !== "observed") throw new Error("Observed advisory witness required");
  assert.equal(point.security.nodes.length, 20);
  point.security.nodes = point.security.nodes.filter((entry) => entry.nodeId !== "peer-0");
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const { id: _pointId, ...pointContent } = point;
  point.id = digest(pointContent);
  const originalCapsuleId = capsule.id, { id: _capsuleId, ...capsuleContent } = capsule;
  capsule.id = digest(capsuleContent);
  for (const node of momentum.nodes) if (node.capsuleId === originalCapsuleId) node.capsuleId = capsule.id;
  for (const development of momentum.developments) if (development.capsuleId === originalCapsuleId) development.capsuleId = capsule.id;
  assert.throws(() => rankGitHubRepromotions({ snapshot: altered, ...context }), /proof-invalid|input-invalid/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A saved security risk origin must name the actual development configuration frozen by its momentum point", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const snapshot = { schemaVersion: 1 as const, github: report.record.github, developments: report.record.githubDevelopments };
  const context = { interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history,
    eventHistory: report.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" as const };
  assert.deepEqual(rankGitHubRepromotions({ snapshot, ...context }), report.record.githubRepromotion);
  const altered = structuredClone(snapshot), momentum = altered.developments.momentum!, capsule = momentum.capsules[0]!, point = capsule.points[0]!;
  assert.equal(point.security.origin!.configuration.version, 1);
  point.security.origin!.configuration.version = 2;
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const { id: _pointId, ...pointContent } = point;
  point.id = digest(pointContent);
  const originalCapsuleId = capsule.id, { id: _capsuleId, ...capsuleContent } = capsule;
  capsule.id = digest(capsuleContent);
  for (const node of momentum.nodes) if (node.capsuleId === originalCapsuleId) node.capsuleId = capsule.id;
  for (const development of momentum.developments) if (development.capsuleId === originalCapsuleId) development.capsuleId = capsule.id;
  assert.throws(() => rankGitHubRepromotions({ snapshot: altered, ...context }), /proof-invalid|input-invalid/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("An altered actual development origin cannot replace the security witness committed with a published momentum point", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const point = report.record.githubDevelopments.momentum!.point!;
  assert.equal(point.security.mode, "observed");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT payload,payload_bytes,payload_sha256 FROM development_runs WHERE slot=?").get(point.slot)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='context_raw_update'").get()!.sql);
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const changed = JSON.parse(String(original.payload));
  changed.configuration.version = 2;
  changed.configurationSha256 = digest(changed.configuration);
  const { id: _id, ...content } = changed;
  changed.id = digest(content);
  const raw = JSON.stringify(changed);
  try {
    // A single original row is replaced by a self-consistent alternative.
    // No momentum or Report commitment is rewritten to endorse that change.
    fault.exec("DROP TRIGGER context_raw_update");
    fault.prepare("UPDATE development_runs SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?")
      .run(raw, Buffer.byteLength(raw), createHash("sha256").update(raw).digest("hex"), point.slot);
    fault.exec(guard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    const snapshot = fixture.observations.repromotionSnapshot!(report.record.github.cutoffUtc);
    assert.equal(snapshot.developments.momentum?.developments.length ?? 0, 0);
    assert.equal(snapshot.github.watchItems.length, 20);
  } finally {
    fault.exec("DROP TRIGGER context_raw_update");
    fault.prepare("UPDATE development_runs SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?")
      .run(original.payload!, original.payload_bytes!, original.payload_sha256!, point.slot);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("An oversized momentum state metadata row is unavailable without discarding its recoverable published proof", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT installed_at FROM momentum_state WHERE singleton=1").get()!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_state_update_guard'").get()!.sql);
  try {
    // The state row's otherwise unused installation text is corrupted beyond
    // its independent 4 KiB cap; epoch, phase, generation and all proofs remain.
    fault.exec("DROP TRIGGER momentum_state_update_guard");
    fault.prepare("UPDATE momentum_state SET installed_at=? WHERE singleton=1").run(String(original.installed_at) + " ".repeat(4096));
    fault.exec(guard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.exec("DROP TRIGGER momentum_state_update_guard");
    fault.prepare("UPDATE momentum_state SET installed_at=? WHERE singleton=1").run(original.installed_at!);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A missing actual momentum head cannot turn a published episode into an apparently complete frozen proof", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT node_id,first_generation,last_generation,step_count,step_digest,last_step_id FROM momentum_heads WHERE node_id='repeat'").get()!;
  const deletion = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_heads_delete_guard'").get()!.sql);
  const insertion = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_heads_insert_guard'").get()!.sql);
  try {
    // Retain the exact Owned row solely for fault restoration. Every raw run,
    // frame, step, capsule and independent Report commitment stays untouched.
    fault.exec("DROP TRIGGER momentum_heads_delete_guard");
    fault.prepare("DELETE FROM momentum_heads WHERE node_id='repeat'").run();
    fault.exec(deletion);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    const snapshot = fixture.observations.repromotionSnapshot!(report.record.github.cutoffUtc);
    assert.equal(snapshot.developments.momentum?.developments.length ?? 0, 0);
    assert.equal(snapshot.github.watchItems.length, 20);
  } finally {
    fault.exec("DROP TRIGGER momentum_heads_insert_guard");
    fault.prepare("INSERT INTO momentum_heads(node_id,first_generation,last_generation,step_count,step_digest,last_step_id) VALUES(?,?,?,?,?,?)")
      .run(original.node_id!, original.first_generation!, original.last_generation!, original.step_count!, original.step_digest!, original.last_step_id!);
    fault.exec(insertion); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A published momentum proof authenticates its real head prefix without confusing later observations with its frozen generation", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (high: boolean) => [repository("repeat", high ? 200 : 100, high ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, high ? 1 : 0, 0))];
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour === 24));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  await fixture.observe(new Date(start + 25 * 3600000).toISOString(), nodes(true));
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report, "a later actual generation does not invalidate the earlier freeze");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT first_generation,last_generation,step_count,step_digest,last_step_id FROM momentum_heads WHERE node_id='repeat'").get()!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_heads_update_guard'").get()!.sql);
  const changes: [string, string | number][] = [["step_count", Number(original.step_count) + 1], ["step_digest", "0".repeat(64)],
    ["first_generation", Number(original.first_generation) + 1], ["last_generation", Number(original.last_generation) - 1], ["last_step_id", "0".repeat(64)]];
  try {
    for (const [field, value] of changes) await t.test(field, () => {
      try {
        fault.exec("DROP TRIGGER momentum_heads_update_guard");
        fault.prepare(`UPDATE momentum_heads SET ${field}=? WHERE node_id='repeat'`).run(value);
        fault.exec(guard);
        assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
      } finally {
        fault.exec("DROP TRIGGER momentum_heads_update_guard");
        fault.prepare(`UPDATE momentum_heads SET ${field}=? WHERE node_id='repeat'`).run(original[field]!);
        fault.exec(guard);
      }
      assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
    });
  } finally { fault.close(); }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A published momentum frame must retain exactly its real candidate step manifest rather than only a findable member for each node", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const slot = report.record.githubDevelopments.momentum!.point!.slot;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = fault.prepare("SELECT payload,payload_bytes,payload_sha256 FROM momentum_frames WHERE slot=?").get(slot)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_frames_update_guard'").get()!.sql);
  const changed = JSON.parse(String(original.payload));
  changed.expected.push(structuredClone(changed.expected[0]));
  const raw = JSON.stringify(changed);
  try {
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    fault.prepare("UPDATE momentum_frames SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?")
      .run(raw, Buffer.byteLength(raw), createHash("sha256").update(raw).digest("hex"), slot);
    fault.exec(guard);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.exec("DROP TRIGGER momentum_frames_update_guard");
    fault.prepare("UPDATE momentum_frames SET payload=?,payload_bytes=?,payload_sha256=? WHERE slot=?")
      .run(original.payload!, original.payload_bytes!, original.payload_sha256!, slot);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Saved observed security origins stay in their momentum point's actual slot policy and cutoff", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20), ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const snapshot = { schemaVersion: 1 as const, github: report.record.github, developments: report.record.githubDevelopments };
  const context = { interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history,
    eventHistory: report.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" as const };
  assert.deepEqual(rankGitHubRepromotions({ snapshot, ...context }), report.record.githubRepromotion);
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  for (const field of ["slot", "policy", "cutoff"]) await t.test(field, () => {
    const altered = structuredClone(snapshot), momentum = altered.developments.momentum!, capsule = momentum.capsules[0]!, point = capsule.points[0]!;
    if (point.security.mode !== "observed") throw new Error("Observed advisory witness required");
    if (field === "slot") point.security.origin.slot = new Date(Date.parse(point.slot) + 3600000).toISOString();
    else if (field === "policy") point.security.origin.policy!.policyVersion++;
    else point.security.origin.availableAtUtc = new Date(Date.parse(point.cutoffUtc) + 1).toISOString();
    const { id: _pointId, ...pointContent } = point;
    point.id = digest(pointContent);
    const originalCapsuleId = capsule.id, { id: _capsuleId, ...capsuleContent } = capsule;
    capsule.id = digest(capsuleContent);
    for (const node of momentum.nodes) if (node.capsuleId === originalCapsuleId) node.capsuleId = capsule.id;
    for (const development of momentum.developments) if (development.capsuleId === originalCapsuleId) development.capsuleId = capsule.id;
    assert.throws(() => rankGitHubRepromotions({ snapshot: altered, ...context }), /proof-invalid|input-invalid/);
  });
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A missing real observation inside a low interval cannot reset a consumed momentum episode", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour < 24 ? 100 : hour < 73 ? 200 : 300, hour < 24 ? 20 : hour < 73 ? 40 : 60),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour < 24 ? 0 : hour < 73 ? 1 : 2, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  await fixture.publish("2026-09-05", 8);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const original = first.record.githubRepromotion.reportedDevelopments.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(original.kind, "momentum");
  for (let hour = 25; hour <= 72; hour++) {
    if (hour === 60) continue; // Actual adjacent observations 59 -> 61 are 120 minutes apart.
    await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  }
  const low = fixture.observations.repromotionSnapshot!(new Date(start + 72 * 3600000 + 300000).toISOString());
  assert.equal(low.developments.momentum!.nodes.find((entry) => entry.nodeId === "repeat")!.status, "non-extreme");
  for (let hour = 73; hour <= 96; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const next = await fixture.publish("2026-09-09");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  const repeated = next.record.githubDevelopments.momentum!.developments.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(repeated.developmentId, original.developmentId);
  assert.equal(repeated.observationId, original.observationId);
  assert.equal(next.record.githubDevelopments.momentum!.capsules.find((entry) => entry.nodeId === "repeat")!.kind, "startup");
  assert.deepEqual(next.record.githubRepromotion.reportedDevelopments, []);
  assert.ok(!next.record.githubRepromotion.selectedNodeIds.includes("repeat"));
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(first.version.id, ownerToken), first);
  assert.deepEqual(fixture.observer.readReport(next.version.id, ownerToken), next);
});

test("A real legacy observation store with unknown startup can recover momentum only through a future complete reset", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  fixture.state.developmentConfiguration.releases = false;
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour < 24 ? 100 : hour < 48 ? 200 : hour < 97 ? 300 : 400,
    hour < 24 ? 20 : hour < 48 ? 40 : hour < 97 ? 60 : 80),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour < 24 ? 0 : hour < 48 ? 1 : hour < 97 ? 2 : 3, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  const ordinary = await fixture.publish("2026-09-05", 8);
  for (let hour = 1; hour <= 23; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  // The old raw observations were created through the public interface while
  // the momentum feature was genuinely absent. Installation is not SQL-faked.
  Object.assign(fixture.state.developmentConfiguration, { version: 2, momentum: true });
  for (let hour = 24; hour <= 48; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const conservative = await fixture.publish("2026-09-07");
  if (conservative.record.schemaVersion !== 10) throw new Error("Record10 required");
  const unproved = conservative.record.githubDevelopments.momentum!;
  assert.equal(unproved.nodes.find((entry) => entry.nodeId === "repeat")!.status, "extreme");
  assert.equal(unproved.nodes.find((entry) => entry.nodeId === "repeat")!.capsuleId, null);
  assert.deepEqual(unproved.developments, []);
  assert.deepEqual(conservative.record.githubRepromotion.reportedDevelopments, []);
  for (let hour = 49; hour <= 120; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const recovered = await fixture.publish("2026-09-10");
  if (recovered.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(recovered.record.githubRepromotion.reportedDevelopments.find((entry) => entry.nodeId === "repeat")!.kind, "momentum");
  const capsule = recovered.record.githubDevelopments.momentum!.capsules.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(capsule.kind, "reset");
  assert.equal(capsule.points.length, 26);
  assert.equal(capsule.points[0]!.slot, new Date(start + 72 * 3600000).toISOString());
  assert.equal(capsule.points.at(-2)!.slot, new Date(start + 96 * 3600000).toISOString());
  assert.equal(capsule.points.at(-1)!.slot, new Date(start + 97 * 3600000).toISOString());
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
  assert.deepEqual(fixture.observer.readReport(conservative.version.id, ownerToken), conservative);
  assert.deepEqual(fixture.observer.readReport(recovered.version.id, ownerToken), recovered);
});

test("An oversized complete startup capsule with individually bounded real points preserves ordinary observation without granting momentum", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source, limits: { ...fixture.state.source.limits, maxResponseBytes: 1024 * 1024 },
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  // These Owned external values exercise the existing strict response Schema's
  // declared limits, not a claim that a live GitHub repository has such topics.
  const topics = Array.from({ length: 100 }, (_, index) => `${String(index).padStart(3, "0")}${"a".repeat(197)}`);
  const nodes = (high: boolean) => [repository("repeat", high ? 200 : 100, high ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, high ? 1 : 0, 0))].map((entry) => ({ ...entry, topics }));
  let priorPointBytes = 0;
  for (let hour = 0; hour <= 23; hour++) {
    const run = await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(false));
    assert.equal(run!.observations.length, 20);
    assert.ok(Buffer.byteLength(JSON.stringify(run)) < 1024 * 1024);
    const actual = fixture.observations.repromotionSnapshot!(new Date(start + hour * 3600000 + 300000).toISOString());
    const pointBytes = Buffer.byteLength(JSON.stringify(actual.developments.momentum!.point!));
    assert.ok(pointBytes < 1024 * 1024);
    assert.equal(actual.developments.momentum!.point!.candidates.length, 20);
    priorPointBytes += pointBytes;
  }
  assert.ok(priorPointBytes > 8 * 1024 * 1024, "the required first 24 actual public points alone exceed a complete capsule's allowance");
  const run = await fixture.observe(new Date(start + 24 * 3600000).toISOString(), nodes(true));
  assert.equal(run!.observations.length, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(run)) < 1024 * 1024);
  const snapshot = fixture.observations.repromotionSnapshot!(new Date(start + 24 * 3600000 + 300000).toISOString());
  assert.equal(snapshot.github.watchItems.length, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot.developments.momentum!.point!)) < 1024 * 1024);
  assert.equal(snapshot.developments.momentum!.point!.candidates.length, 20);
  const repeat = snapshot.developments.momentum!.nodes.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(repeat.status, "extreme");
  assert.equal(repeat.capsuleId, null);
  assert.ok(repeat.reasons.includes("github-momentum-resource-limit"));
  assert.deepEqual(snapshot.developments.momentum!.developments, []);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.ok(report.record.githubRepromotion.selectedNodeIds.includes("repeat"), "ordinary Heat remains available");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("An actual unknown GHSA risk remains quarantined when its repository has an otherwise exceptional first momentum signal", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (high: boolean) => [repository("repeat", high ? 200 : 100, high ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, high ? 1 : 0, 0))];
  for (let hour = 0; hour <= 23; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(false));
  fixture.state.advisories = [{ ghsa_id: "GHSA-abcd-2345-efgh", cve_id: null, url: "https://api.github.com/advisories/GHSA-abcd-2345-efgh",
    html_url: "https://github.com/advisories/GHSA-abcd-2345-efgh", repository_advisory_url: "https://api.github.com/repos/example/repeat/security-advisories/GHSA-abcd-2345-efgh",
    source_code_location: "https://github.com/example/repeat", type: "reviewed", severity: "high", summary: "Owned unknown affected range",
    description: "Owned fixture: affected versions have not been established.", identifiers: [{ type: "GHSA", value: "GHSA-abcd-2345-efgh" }], references: [],
    published_at: "2026-09-05T21:00:00Z", updated_at: "2026-09-05T21:00:00Z", github_reviewed_at: "2026-09-05T21:00:00Z",
    nvd_published_at: null, withdrawn_at: null, vulnerabilities: null, cwes: [], credits: [] }];
  await fixture.observe(new Date(start + 24 * 3600000).toISOString(), nodes(true));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  const momentum = report.record.githubDevelopments.momentum!, point = momentum.point!;
  const counts = point.candidates.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(counts.current!.observation.stars, 200);
  assert.equal(counts.historical!.observation.stars, 100);
  assert.equal(counts.current!.observation.forks, 40);
  assert.equal(counts.historical!.observation.forks, 20);
  assert.equal(point.candidates.length, 20);
  if (point.security.mode !== "observed") throw new Error("Actual observed security witness required");
  assert.equal(point.security.nodes.length, 20);
  const risk = point.security.nodes.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(risk.risks.length, 1);
  assert.equal(risk.risks[0]!.status, "unknown");
  const origin = report.record.githubDevelopments.runs.find((entry) => entry.slot === point.slot)!;
  assert.equal(point.security.origin.developmentRunId, origin.id);
  assert.deepEqual(risk.risks, origin.security!.risks.filter((entry) => entry.nodeId === "repeat"));
  assert.equal(risk.historyUnavailable, origin.security!.history.unavailableNodeIds.includes("repeat"));
  assert.equal(momentum.nodes.find((entry) => entry.nodeId === "repeat")!.status, "unknown");
  assert.deepEqual(momentum.developments, []);
  assert.equal(report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.reason, "security-risk-quarantined");
  assert.ok(!report.record.githubRepromotion.selectedNodeIds.includes("repeat"));
  assert.ok(report.record.githubRepromotion.selectedNodeIds.some((nodeId) => nodeId.startsWith("peer-")));
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A current momentum bank keeps complete codepoint-ordered groups when five individually bounded episodes exceed its shared allowance", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.searchPagination = true;
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source, limits: { ...fixture.state.source.limits, maxResponseBytes: 1024 * 1024 },
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const topics = Array.from({ length: 65 }, (_, index) => `${String(index).padStart(3, "0")}${"a".repeat(197)}`);
  const nodes = (hour: number) => Array.from({ length: 20 }, (_, i) => ({ ...repository(`bank-${String(i).padStart(2, "0")}`,
    i < 5 && hour >= 23 + i ? 200 + 100 * i : 100, 20), topics: hour < 23 ? topics : [] }));
  type Snapshot = ReturnType<NonNullable<typeof fixture.observations.repromotionSnapshot>>;
  const snapshots = new Map<number, Snapshot>();
  let originalBytes = 0;
  for (let hour = 0; hour <= 27; hour++) {
    const run = await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
    assert.equal(run!.observations.length, 20);
    assert.ok(Buffer.byteLength(JSON.stringify(run)) < 1024 * 1024);
    originalBytes += Buffer.byteLength(JSON.stringify(run));
    const snapshot = fixture.observations.repromotionSnapshot!(new Date(start + hour * 3600000 + 300000).toISOString());
    snapshots.set(hour, snapshot);
    const development = snapshot.developments.runs.find((entry) => entry.slot === run!.scheduledAtUtc)!;
    assert.ok(development);
    originalBytes += Buffer.byteLength(JSON.stringify(development));
  }
  const firstFour = snapshots.get(26)!.developments.momentum!;
  assert.deepEqual(firstFour.capsules.map((entry) => entry.nodeId), ["bank-00", "bank-01", "bank-02", "bank-03"]);
  const firstPoints = [...new Map(firstFour.capsules.flatMap((entry) => entry.points).map((point) => [point.id, point])).values()];
  t.diagnostic(JSON.stringify({ firstFourBytes: firstFour.capsules.map((entry) => Buffer.byteLength(JSON.stringify(entry))),
    firstFourBankBytes: Buffer.byteLength(JSON.stringify(firstFour.capsules)), originalBytes,
    firstPointsBytes: firstPoints.reduce((sum, point) => sum + Buffer.byteLength(JSON.stringify(point)), 0) }));
  // Publish the actual 27th-hour snapshot before introducing the later read
  // control. Request9 carries this explicit cutoff; no saved proof is injected.
  const cutoffUtc = new Date(start + 27 * 3600000 + 300000).toISOString();
  fixture.state.now = new Date(Date.parse(cutoffUtc) + 600000).toISOString();
  const version = await fixture.observer.produce({ schemaVersion: 9, taskId: "owned-bank-report", businessDate: "2026-09-06", configurationId: "owned-bank",
    evidenceBundle: { schemaVersion: 2, id: "owned-bank-report", businessDate: "2026-09-06", configurationId: "owned-bank",
      windowStartUtc: new Date(Date.parse(cutoffUtc) - 86400000).toISOString(), cutoffUtc, evidence: [], coverageGaps: [] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: [] })) });
  const report = fixture.observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubDevelopments.momentum, snapshots.get(27)!.developments.momentum);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.ok(report.record.githubRepromotion.selectedNodeIds.length > 0, "ordinary selection remains available");
  assert.deepEqual(rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: report.record.github, developments: report.record.githubDevelopments },
    interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history,
    eventHistory: report.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" }), report.record.githubRepromotion);
  // Read the fifth real, already committed capsule through a later public
  // snapshot whose real search fills all 50 candidate places without the first
  // two nodes. A shorter search would retain the old identities for refresh.
  const nextRun = await fixture.observe(new Date(start + 28 * 3600000).toISOString(), [...nodes(28).slice(2),
    ...Array.from({ length: 32 }, (_, i) => ({ ...repository(`z-peer-${i}`, 100, 20), topics: [] }))]);
  t.diagnostic(JSON.stringify({ nextRunCount: nextRun!.observations.length, nextRunQueries: nextRun!.queries,
    retainedFirstNodes: nextRun!.observations.filter((entry) => entry.nodeId === "bank-00" || entry.nodeId === "bank-01").map((entry) => entry.nodeId) }));
  const nextPool = fixture.observations.repromotionSnapshot!(new Date(start + 28 * 3600000 + 300000).toISOString());
  t.diagnostic(JSON.stringify({ nextPoolReasons: nextPool.developments.reasons, momentumReasons: nextPool.developments.momentum?.reasons }));
  const lastFour = nextPool.developments.momentum!;
  assert.ok(lastFour, "the independent fifth-capsule read control must be available");
  assert.equal(lastFour.point!.candidates.length, 50);
  assert.ok(lastFour.point!.candidates.every((entry) => entry.nodeId !== "bank-00" && entry.nodeId !== "bank-01"));
  assert.deepEqual(lastFour.capsules.map((entry) => entry.nodeId), ["bank-02", "bank-03", "bank-04"]);
  const all = [...new Map([...firstFour.capsules, ...lastFour.capsules].map((capsule) => [capsule.nodeId, capsule])).values()];
  assert.equal(all.length, 5);
  const capsuleBytes = all.map((capsule) => Buffer.byteLength(JSON.stringify(capsule)));
  assert.ok(capsuleBytes.every((bytes) => bytes < 8 * 1024 * 1024));
  const bankBytes = Buffer.byteLength(JSON.stringify(all));
  assert.ok(bankBytes > 32 * 1024 * 1024);
  assert.ok(all.every((capsule) => capsule.kind === "startup" && capsule.points.length <= 28));
  const firstSignal = all[0]!.points.at(-1)!.candidates.find((entry) => entry.nodeId === "bank-00")!;
  assert.equal(Date.parse(firstSignal.current!.observation.observedAtUtc) - Date.parse(firstSignal.historical!.observation.observedAtUtc), 23 * 3600000);
  const points = [...new Map(all.flatMap((capsule) => capsule.points).map((point) => [point.id, point])).values()];
  assert.equal(points.length, 28);
  assert.ok(points.every((point) => Buffer.byteLength(JSON.stringify(point)) < 1024 * 1024));
  // Every original is a returned public run; the frame manifests and current
  // twenty steps use their independently approved maximum sizes. Even this
  // superset including all five capsules cannot hit the separate 64 MiB gate.
  const payloadUpperBound = originalBytes + capsuleBytes.reduce((sum, bytes) => sum + bytes, 0) +
    points.reduce((sum, point) => sum + Buffer.byteLength(JSON.stringify(point)) + 32768 + 32, 0) + 20 * 65536;
  assert.ok(payloadUpperBound < 64 * 1024 * 1024);
  t.diagnostic(JSON.stringify({ capsuleBytes, bankBytes, payloadUpperBound }));
  const current = snapshots.get(27)!.developments.momentum;
  assert.ok(current, "the shared bank allowance cannot discard all independently affordable groups");
  assert.deepEqual(current.capsules.map((entry) => entry.nodeId), ["bank-00", "bank-01", "bank-02", "bank-03"]);
  const omitted = current.nodes.find((entry) => entry.nodeId === "bank-04")!;
  assert.equal(omitted.status, "extreme");
  assert.equal(omitted.capsuleId, all.find((entry) => entry.nodeId === "bank-04")!.id);
  assert.ok(omitted.reasons.includes("github-momentum-resource-limit"));
  assert.ok(current.nodes.filter((entry) => entry.nodeId < "bank-04").every((entry) => entry.status === "non-extreme"));
  assert.deepEqual(current.developments, []);
  assert.equal(snapshots.get(27)!.github.watchItems.length, 20);
  fixture.restart();
  assert.deepEqual(fixture.observations.repromotionSnapshot!(new Date(start + 27 * 3600000 + 300000).toISOString()), snapshots.get(27));
  assert.deepEqual(fixture.observer.readReport(version.id, ownerToken), report);
});

test("A small momentum snapshot retains previously observed peers for refresh after they leave search results", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => Array.from({ length: 20 }, (_, i) => repository(`bank-${String(i).padStart(2, "0")}`,
    i < 5 && hour >= 23 + i ? 200 + 100 * i : 100, 20));
  for (let hour = 0; hour <= 27; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const before = fixture.observations.repromotionSnapshot!(new Date(start + 27 * 3600000 + 300000).toISOString());
  assert.equal(before.developments.momentum!.capsules.length, 5);
  await fixture.observe(new Date(start + 28 * 3600000).toISOString(), [...nodes(28).slice(2), repository("z-peer-a", 100, 20), repository("z-peer-b", 100, 20)]);
  const after = fixture.observations.repromotionSnapshot!(new Date(start + 28 * 3600000 + 300000).toISOString());
  assert.ok(after.developments.momentum, "peer changes make current evaluation incomplete, not the actual point absent");
  assert.equal(after.developments.momentum.point!.candidates.length, 22);
  assert.equal(after.developments.momentum.point!.candidates.find((entry) => entry.nodeId === "bank-00")!.status, "quarantined");
  assert.equal(after.developments.momentum.point!.candidates.find((entry) => entry.nodeId === "bank-01")!.status, "quarantined");
  assert.deepEqual(after.developments.momentum.capsules.map((entry) => entry.nodeId), ["bank-00", "bank-01", "bank-02", "bank-03", "bank-04"]);
  assert.deepEqual(after.developments.momentum.developments, []);
});

test("A missing installed momentum heads table withholds momentum without closing existing ordinary reads or reinstalling its authority", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  const ordinary = await fixture.publish("2026-09-05", 8);
  assert.equal(ordinary.record.schemaVersion, 9);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const cutoffUtc = report.record.evidenceBundle.cutoffUtc;
  const baseline = fixture.observations.rankingSnapshot!(cutoffUtc);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  // Retain exactly the Owned table and its guards for restoration. Neither
  // these rows nor SQLite counts serve as the business-result oracle.
  const table = String(fault.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='momentum_heads'").get()!.sql);
  const guards = fault.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name='momentum_heads' ORDER BY name").all().map((row) => String(row.sql));
  const rows = fault.prepare("SELECT node_id,first_generation,last_generation,step_count,step_digest,last_step_id FROM momentum_heads").all();
  fault.exec("DROP TABLE momentum_heads");
  try {
    fixture.restart();
    assert.deepEqual(fixture.observations.rankingSnapshot!(cutoffUtc), baseline);
    assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
    const degraded = fixture.observations.repromotionSnapshot!(cutoffUtc);
    assert.equal(degraded.developments.momentum, undefined);
    assert.ok(degraded.developments.reasons.includes("github-momentum-point-unavailable"));
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    // CREATE (not IF NOT EXISTS) also catches an impermissible fresh reinstall.
    fault.exec(table);
    for (const row of rows) fault.prepare("INSERT INTO momentum_heads(node_id,first_generation,last_generation,step_count,step_digest,last_step_id) VALUES (?,?,?,?,?,?)")
      .run(row.node_id!, row.first_generation!, row.last_generation!, row.step_count!, row.step_digest!, row.last_step_id!);
    for (const guard of guards) fault.exec(guard);
    fault.close();
    fixture.restart();
  }
  assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Missing actual momentum transaction tables preserve old ordinary reads but cannot commit a new run until exact restoration", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour >= 24 ? 200 : 100, hour >= 24 ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour >= 24 ? 1 : 0, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  const ordinary = await fixture.publish("2026-09-05", 8);
  assert.equal(ordinary.record.schemaVersion, 9);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  let nextHour = 25;
  for (const name of ["momentum_state", "momentum_pending"]) await t.test(name, async () => {
    const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
    const table = String(fault.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name)!.sql);
    const guards = fault.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name=? ORDER BY name").all(name).map((row) => String(row.sql));
    const rows = fault.prepare(`SELECT * FROM ${name}`).all();
    const nextSlot = new Date(start + nextHour * 3600000).toISOString();
    const cutoffUtc = new Date(Date.parse(nextSlot) + 300000).toISOString();
    const before = fixture.observations.rankingSnapshot!(cutoffUtc);
    fault.exec(`DROP TABLE ${name}`);
    try {
      fixture.restart();
      assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
      assert.deepEqual(fixture.observations.rankingSnapshot!(cutoffUtc), before);
      assert.equal(fixture.observations.repromotionSnapshot!(cutoffUtc).developments.momentum, undefined);
      await assert.rejects(fixture.observe(nextSlot, nodes(nextHour)), /immutable momentum authority|no such table/);
      assert.deepEqual(fixture.observations.rankingSnapshot!(cutoffUtc), before, "the failed write cannot publish a partially committed raw run");
      assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    } finally {
      fault.exec(table);
      for (const row of rows) {
        const columns = Object.keys(row);
        fault.prepare(`INSERT INTO ${name}(${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...Object.values(row));
      }
      for (const guard of guards) fault.exec(guard);
      fault.close();
      fixture.restart();
    }
    const restored = await fixture.observe(nextSlot, nodes(nextHour));
    assert.equal(restored!.scheduledAtUtc, nextSlot);
    assert.equal(fixture.observations.rankingSnapshot!(cutoffUtc).runs.at(-1)!.scheduledAtUtc, nextSlot);
    assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
    assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
    nextHour++;
  });
});

test("A real momentum episode with no novel position remains unconsumed until a later report has an actual novel repository", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false });
  const names = Array.from({ length: 20 }, (_, i) => i === 0 ? "repeat" : `peer-${i}`);
  const previouslySelected = new Set<string>();
  for (let batch = 0; batch < 3; batch++) {
    await fixture.observe(`2026-09-0${3 + batch}T23:25:00.000Z`, names.slice(batch * 7, (batch + 1) * 7).map((name) => repository(name, 100, 20)));
    const prior = await fixture.publish(`2026-09-0${4 + batch}`, 8);
    if (prior.record.schemaVersion !== 9) throw new Error("Record9 required");
    prior.record.githubRanking.selectedNodeIds.forEach((node) => previouslySelected.add(node));
  }
  assert.deepEqual([...previouslySelected].sort(), [...names].sort());
  Object.assign(fixture.state.developmentConfiguration, { version: 2, momentum: true });
  const start = Date.parse("2026-09-06T22:25:00.000Z");
  const nodes = (hour: number) => names.map((name) => repository(name, name === "repeat" && hour >= 49 ? 200 + (hour - 49) * 5 : 100, 20));
  for (let hour = 0; hour <= 49; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const withheld = await fixture.publish("2026-09-09");
  if (withheld.record.schemaVersion !== 10) throw new Error("Record10 required");
  const available = withheld.record.githubDevelopments.momentum!.developments.find((entry) => entry.nodeId === "repeat")!;
  assert.ok(available, "the real complete reset must provide an episode independently of publication quota");
  assert.equal(withheld.record.githubRepromotion.quota.eligibleNovel, 0);
  assert.deepEqual(withheld.record.githubRepromotion.selectedNodeIds, []);
  assert.deepEqual(withheld.record.githubRepromotion.reportedDevelopments, []);
  for (let hour = 50; hour <= 73; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [...nodes(hour), ...(hour === 73 ? [repository("novel", 100, 20)] : [])]);
  const published = await fixture.publish("2026-09-10");
  if (published.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(new Set(published.record.githubRepromotion.selectedNodeIds), new Set(["repeat", "novel"]));
  assert.equal(published.record.githubRepromotion.quota.selectedNovel, 1);
  assert.equal(published.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.equal(published.record.githubRepromotion.reportedDevelopments[0]!.developmentId, available.developmentId);
  assert.equal(published.record.githubRepromotion.reportedDevelopments[0]!.observationId, available.observationId);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(withheld.version.id, ownerToken), withheld);
  assert.deepEqual(fixture.observer.readReport(published.version.id, ownerToken), published);
});

test("Absent or false momentum evidence capability keeps actual ordinary counts but never writes them into momentum proof", async (t) => {
  for (const permission of [undefined, false]) await t.test(permission === undefined ? "absent" : "false", async (child) => {
    const fixture = await repromotionFixture(child);
    if (permission === false) fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
      github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: false } } });
    Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
    const start = Date.parse("2026-09-04T23:25:00.000Z");
    for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
      [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20),
        ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
    const report = await fixture.publish("2026-09-06");
    if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
    const ordinary = report.record.github.watchItems.find((entry) => entry.nodeId === "repeat")!;
    assert.equal(ordinary.current!.stars, 200);
    assert.equal(ordinary.historical!.stars, 100);
    assert.ok(report.record.githubRepromotion.selectedNodeIds.includes("repeat"));
    const momentum = report.record.githubDevelopments.momentum!;
    assert.ok(momentum.point);
    assert.equal(momentum.point.candidates.length, 20);
    assert.ok(momentum.point.candidates.every((entry) => entry.current === null && entry.historical === null));
    assert.ok(momentum.nodes.every((entry) => entry.status === "unknown"));
    assert.deepEqual(momentum.capsules, []);
    assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
    fixture.restart();
    assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  });
});

test("Withdrawing the actual momentum source capability denies a published episode and exact permission restoration preserves its identity", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  for (let hour = 0; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(),
    [repository("repeat", hour === 24 ? 200 : 100, hour === 24 ? 40 : 20),
      ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour === 24 ? 1 : 0, 0))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const cutoffUtc = report.record.evidenceBundle.cutoffUtc;
  const snapshot = fixture.observations.repromotionSnapshot!(cutoffUtc);
  const original = fixture.state.source;
  fixture.state.source = SourcePolicySchema.parse({ ...original, version: original.version + 1,
    github: { ...original.github!, events: { ...original.github!.events!, allowMomentumEvidence: false } } });
  try {
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    assert.equal(fixture.observations.repromotionSnapshot!(cutoffUtc).developments.momentum, undefined);
    fixture.restart();
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
  } finally {
    // Restore the exact Owned source authority, not stored episode/report data.
    fixture.state.source = original;
  }
  assert.deepEqual(fixture.observations.repromotionSnapshot!(cutoffUtc), snapshot);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("An overlong real startup and a later peer-interrupted low interval cannot grant momentum until a future complete reset", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour < 29 ? 100 : hour < 78 ? 200 : hour < 127 ? 300 : 400, 20),
    ...Array.from({ length: 19 }, (_, i) => repository(hour === 65 && i === 18 ? "new-peer" : `peer-${i}`, 100, 20)),
    ...(hour > 65 ? [repository("new-peer", 100, 20)] : []),
    ...(hour === 144 ? [repository("novel", 100, 20)] : [])];
  const publicPoints = new Map<number, NonNullable<ReturnType<NonNullable<typeof fixture.observations.repromotionSnapshot>>["developments"]["momentum"]>>();
  const reports: Awaited<ReturnType<typeof fixture.publish>>[] = [];
  for (let hour = 0; hour <= 144; hour++) {
    const run = await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
    assert.equal(run!.scheduledAtUtc, new Date(start + hour * 3600000).toISOString());
    if ([29, 64, 65, 66, 78, 127].includes(hour)) publicPoints.set(hour,
      fixture.observations.repromotionSnapshot!(new Date(start + hour * 3600000 + 300000).toISOString()).developments.momentum!);
    if (hour === 48) reports.push(await fixture.publish("2026-09-07"));
    if (hour === 96) reports.push(await fixture.publish("2026-09-09"));
    if (hour === 144) reports.push(await fixture.publish("2026-09-11"));
  }
  const initial = publicPoints.get(29)!;
  assert.equal(initial.nodes.find((entry) => entry.nodeId === "repeat")!.status, "extreme");
  assert.deepEqual(initial.capsules, [], "thirty actual startup observations cannot be truncated to the approved twenty-eight");
  assert.equal(publicPoints.get(64)!.nodes.find((entry) => entry.nodeId === "repeat")!.status, "non-extreme");
  const interrupted = publicPoints.get(65)!;
  assert.equal(interrupted.point!.candidates.find((entry) => entry.nodeId === "new-peer")!.status, "cold-start");
  assert.equal(interrupted.point!.candidates.find((entry) => entry.nodeId === "peer-18")!.status, "quarantined");
  assert.equal(interrupted.nodes.find((entry) => entry.nodeId === "repeat")!.status, "unknown");
  assert.equal(publicPoints.get(66)!.nodes.find((entry) => entry.nodeId === "repeat")!.status, "non-extreme");
  assert.equal(publicPoints.get(78)!.nodes.find((entry) => entry.nodeId === "repeat")!.status, "extreme");
  assert.deepEqual(publicPoints.get(78)!.capsules, [], "the peer interruption cannot count as a low point or preserve an incomplete reset");
  for (const report of reports.slice(0, 2)) {
    if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
    assert.deepEqual(report.record.githubDevelopments.momentum!.capsules, []);
    assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  }
  const recovered = reports[2]!;
  if (recovered.record.schemaVersion !== 10) throw new Error("Record10 required");
  const repeat = recovered.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!;
  t.diagnostic(JSON.stringify({ quota: recovered.record.githubRepromotion.quota, selectedNodeIds: recovered.record.githubRepromotion.selectedNodeIds,
    repeat: { reason: repeat.reason, eventReason: repeat.eventReason, novel: repeat.novel, score: repeat.score, developments: repeat.developments.map((entry) => entry.kind) } }));
  const capsule = recovered.record.githubDevelopments.momentum!.capsules.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(capsule.kind, "reset");
  assert.equal(capsule.points.length, 26);
  assert.equal(capsule.points[0]!.slot, new Date(start + 102 * 3600000).toISOString());
  assert.equal(capsule.points.at(-2)!.slot, new Date(start + 126 * 3600000).toISOString());
  const completePeers = capsule.points[0]!.candidates.map((entry) => entry.nodeId);
  assert.equal(completePeers.length, 21);
  for (const point of capsule.points) {
    assert.deepEqual(point.candidates.map((entry) => entry.nodeId), completePeers);
    assert.ok(point.candidates.every((entry) => entry.status === "measured" && entry.current !== null && entry.historical !== null));
  }
  assert.equal(capsule.onsetObservationId, publicPoints.get(127)!.point!.candidates.find((entry) => entry.nodeId === "repeat")!.current!.observation.id);
  assert.ok(recovered.record.githubRepromotion.selectedNodeIds.includes("novel"));
  assert.equal(recovered.record.githubRepromotion.reportedDevelopments.find((entry) => entry.nodeId === "repeat")!.observationId, capsule.onsetObservationId);
  fixture.restart();
  for (const report of reports) assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Actual mixed security release and momentum developments retain their priority quota and once-only visible consumption", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("security", 100 + Math.floor(hour * 10 / 24), 20),
    repository("release", 100 + Math.floor(hour * 20 / 24), 20), repository("momentum", 100 + Math.floor(hour * 100 / 24), 20),
    ...Array.from({ length: 17 }, (_, i) => repository(`peer-${i}`, Math.floor(hour / 24), 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  const ordinary = await fixture.publish("2026-09-05", 8);
  if (ordinary.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(new Set(ordinary.record.githubRanking.selectedNodeIds), new Set(["security", "release", "momentum"]));
  for (let hour = 1; hour < 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  fixture.state.releasesByName["example/release"] = [ownedRelease()];
  fixture.state.advisories = [{ ghsa_id: "GHSA-abcd-2345-efgh", cve_id: null,
    url: "https://api.github.com/advisories/GHSA-abcd-2345-efgh", html_url: "https://github.com/advisories/GHSA-abcd-2345-efgh",
    repository_advisory_url: "https://api.github.com/repos/example/security/security-advisories/GHSA-abcd-2345-efgh",
    source_code_location: "https://github.com/example/security", type: "reviewed", severity: "high", summary: "Owned security risk",
    description: "Affected versions permit unauthorized query access.", identifiers: [{ type: "GHSA", value: "GHSA-abcd-2345-efgh" }], references: [],
    published_at: "2026-09-05T21:00:00Z", updated_at: "2026-09-05T21:00:00Z", github_reviewed_at: "2026-09-05T21:00:00Z",
    nvd_published_at: null, withdrawn_at: null, vulnerabilities: [{ package: { ecosystem: "npm", name: "owned-query-package" },
      vulnerable_version_range: ">=1.0.0 <1.2.0", first_patched_version: "1.2.0", vulnerable_functions: null }], cwes: [], credits: [] }];
  await fixture.observe(new Date(start + 24 * 3600000).toISOString(), nodes(24));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds.slice(0, 3), ["security", "release", "momentum"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments.map((entry) => entry.kind), ["security", "release", "momentum"]);
  assert.equal(report.record.githubRepromotion.quota.actual, 7);
  assert.equal(report.record.githubRepromotion.quota.selectedNovel, 4);
  for (const nodeId of ["security", "release", "momentum"]) {
    const candidate: typeof report.record.githubRepromotion.candidates[number] = report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === nodeId)!;
    assert.equal(candidate.ordinaryScore, 0);
    assert.equal(candidate.recoveryMultiplier, 0);
    assert.equal(candidate.effectiveRecoveryMultiplier, 1);
    assert.ok(candidate.frequencyMultiplier < 1);
  }
  assert.match(report.canonicalMarkdown, /风险更新/);
  assert.match(report.canonicalMarkdown, /observer-github-momentum-v1/);
  for (let hour = 25; hour <= 48; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const next = await fixture.publish("2026-09-07");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(next.record.githubRepromotion.reportedDevelopments, []);
  for (const nodeId of ["security", "release", "momentum"]) assert.equal(next.record.githubRepromotion.candidates.find((entry) => entry.nodeId === nodeId)!.eventReason, "already-reported");
  assert.deepEqual(next.record.githubRepromotion.eventHistory.entries.find((entry) => entry.versionId === report.version.id)!.developments,
    report.record.githubRepromotion.reportedDevelopments.map(({ nodeId, kind, eventId, developmentId, revisionId, observationId }) =>
      ({ nodeId, kind, eventId, developmentId, revisionId, observationId })));
  fixture.restart();
  for (const saved of [ordinary, report, next]) assert.deepEqual(fixture.observer.readReport(saved.version.id, ownerToken), saved);
});

test("An actual leftover momentum pending row or dirty state cannot be hidden or washed away by a new observation", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (hour: number) => [repository("repeat", hour >= 24 ? 200 : 100, hour >= 24 ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, hour >= 24 ? 1 : 0, 0))];
  await fixture.observe(new Date(start).toISOString(), nodes(0));
  const ordinary = await fixture.publish("2026-09-05", 8);
  for (let hour = 1; hour <= 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(hour));
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "momentum");
  const cutoffUtc = report.record.evidenceBundle.cutoffUtc;
  const baseline = fixture.observations.rankingSnapshot!(cutoffUtc);
  const slot = report.record.githubDevelopments.momentum!.point!.slot;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const insertion = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_pending_insert_guard'").get()!.sql);
  const deletion = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_pending_delete_guard'").get()!.sql);
  assert.equal(fault.prepare("SELECT slot FROM momentum_pending WHERE slot=?").get(slot), undefined, "the exact Owned insertion target must be absent for restoration");
  fault.exec("DROP TRIGGER momentum_pending_insert_guard");
  fault.prepare("INSERT INTO momentum_pending(slot) VALUES (?)").run(slot);
  fault.exec(insertion);
  try {
    assert.deepEqual(fixture.observations.rankingSnapshot!(cutoffUtc), baseline);
    assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
    assert.equal(fixture.observations.repromotionSnapshot!(cutoffUtc).developments.momentum, undefined);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    await assert.rejects(fixture.observe(new Date(start + 25 * 3600000).toISOString(), nodes(25)), /momentum-history-invalid/);
    assert.equal(fixture.observations.rankingSnapshot!(new Date(start + 25 * 3600000 + 300000).toISOString()).runs.at(-1)!.scheduledAtUtc, slot);
  } finally {
    fault.exec("DROP TRIGGER momentum_pending_delete_guard");
    fault.prepare("DELETE FROM momentum_pending WHERE slot=?").run(slot);
    fault.exec(deletion); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  const resumed = await fixture.observe(new Date(start + 25 * 3600000).toISOString(), nodes(25));
  assert.equal(resumed!.scheduledAtUtc, new Date(start + 25 * 3600000).toISOString());
  assert.deepEqual(await fixture.observe(resumed!.scheduledAtUtc, nodes(25)), resumed, "the normal same-slot observation remains idempotent");
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  const dirtyFault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const stateRow = dirtyFault.prepare("SELECT phase FROM momentum_state WHERE singleton=1").get()!;
  const stateGuard = String(dirtyFault.prepare("SELECT sql FROM sqlite_master WHERE name='momentum_state_update_guard'").get()!.sql);
  dirtyFault.exec("DROP TRIGGER momentum_state_update_guard");
  dirtyFault.prepare("UPDATE momentum_state SET phase='dirty' WHERE singleton=1").run();
  dirtyFault.exec(stateGuard);
  try {
    fixture.restart();
    assert.deepEqual(fixture.observer.readReport(ordinary.version.id, ownerToken), ordinary);
    assert.deepEqual(fixture.observations.rankingSnapshot!(cutoffUtc), baseline);
    assert.equal(fixture.observations.repromotionSnapshot!(cutoffUtc).developments.momentum, undefined);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
    await assert.rejects(fixture.observe(new Date(start + 26 * 3600000).toISOString(), nodes(26)), /momentum-history-invalid/);
    assert.equal(fixture.observations.rankingSnapshot!(new Date(start + 26 * 3600000 + 300000).toISOString()).runs.at(-1)!.scheduledAtUtc, resumed!.scheduledAtUtc);
  } finally {
    dirtyFault.exec("DROP TRIGGER momentum_state_update_guard");
    dirtyFault.prepare("UPDATE momentum_state SET phase=? WHERE singleton=1").run(stateRow.phase!);
    dirtyFault.exec(stateGuard); dirtyFault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  const restored = await fixture.observe(new Date(start + 26 * 3600000).toISOString(), nodes(26));
  assert.equal(restored!.scheduledAtUtc, new Date(start + 26 * 3600000).toISOString());
  assert.deepEqual(await fixture.observe(restored!.scheduledAtUtc, nodes(26)), restored);
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A real Report10 cannot discard its entire captured momentum section even when the locally valid ranking has no event", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true });
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 100, 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, 0, 0))]);
  const report = await fixture.publish("2026-09-05");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.ok(report.record.githubDevelopments.momentum!.freeze.pointId);
  assert.equal(report.record.githubDevelopments.momentum!.point!.candidates.length, 20);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  const record = structuredClone(report.record);
  delete record.githubDevelopments.momentum;
  assert.deepEqual(rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: record.github, developments: record.githubDevelopments },
    interestProfile: record.interestProfile, coverageHistory: record.githubRanking.history, eventHistory: record.githubRepromotion.eventHistory,
    algorithmVersion: "observer-github-repromotion-v1" }), report.record.githubRepromotion);
  assert.equal(githubRepromotionMarkdown(record), report.canonicalMarkdown, "the missing zero-event section does not change the locally derived body");
  assert.equal(createHash("sha256").update(report.canonicalMarkdown).digest("hex"), report.version.canonicalMarkdownSha256);
  const altered = PublishedReportSchema.parse({ ...report, record, version: { ...report.version,
    reportRecordSha256: createHash("sha256").update(JSON.stringify(record)).digest("hex") } });
  const fault = new DatabaseSync(fixture.reportPath);
  const original = fault.prepare("SELECT payload FROM reports WHERE id=?").get(report.version.id)!;
  const guard = String(fault.prepare("SELECT sql FROM sqlite_master WHERE name='immutable_report_update'").get()!.sql);
  fault.exec("DROP TRIGGER immutable_report_update");
  // Only the Owned report projection and its self-hash change. Its real row
  // key and independent development_capture_sha256 are deliberately untouched.
  fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(altered), report.version.id);
  fault.exec(guard);
  try {
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /integrity/);
    fixture.restart();
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /integrity/);
  } finally {
    fault.exec("DROP TRIGGER immutable_report_update");
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(original.payload!, report.version.id);
    fault.exec(guard); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Four actual reviewed advisories retain their complete security run while an overflowing momentum risk witness becomes unavailable", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source = SourcePolicySchema.parse({ ...fixture.state.source,
    github: { ...fixture.state.source.github!, events: { ...fixture.state.source.github!.events!, allowMomentumEvidence: true,
      allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true } } });
  Object.assign(fixture.state.developmentConfiguration, { releases: false, momentum: true, advisories: true });
  const start = Date.parse("2026-09-04T23:25:00.000Z");
  const nodes = (high: boolean) => [repository("repeat", high ? 200 : 100, high ? 40 : 20),
    ...Array.from({ length: 19 }, (_, i) => repository(`peer-${i}`, high ? 1 : 0, 0))];
  for (let hour = 0; hour < 24; hour++) await fixture.observe(new Date(start + hour * 3600000).toISOString(), nodes(false));
  const ids = ["GHSA-abcd-2345-efgh", "GHSA-bcde-2345-efgh", "GHSA-cdef-2345-efgh", "GHSA-defg-2345-efgh"];
  fixture.state.advisories = ids.map((ghsaId) => ({ ghsa_id: ghsaId, cve_id: null,
    url: `https://api.github.com/advisories/${ghsaId}`, html_url: `https://github.com/advisories/${ghsaId}`,
    repository_advisory_url: `https://api.github.com/repos/example/repeat/security-advisories/${ghsaId}`,
    source_code_location: "https://github.com/example/repeat", type: "reviewed", severity: "high", summary: "Owned security risk",
    description: "Affected versions permit unauthorized query access.", identifiers: [{ type: "GHSA", value: ghsaId }], references: [],
    published_at: "2026-09-05T21:00:00Z", updated_at: "2026-09-05T21:00:00Z", github_reviewed_at: "2026-09-05T21:00:00Z",
    nvd_published_at: null, withdrawn_at: null, vulnerabilities: [{ package: { ecosystem: "npm", name: "owned-query-package" },
      vulnerable_version_range: ">=1.0.0 <1.2.0", first_patched_version: "1.2.0", vulnerable_functions: null }], cwes: [], credits: [] }));
  const run = await fixture.observe(new Date(start + 24 * 3600000).toISOString(), nodes(true));
  assert.equal(run!.observations.length, 20);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  const original = report.record.githubDevelopments.runs.find((entry) => entry.slot === run!.scheduledAtUtc)!;
  assert.deepEqual(original.security!.risks.filter((entry) => entry.nodeId === "repeat").map((entry) => entry.ghsaId).sort(), ids);
  assert.ok(original.security!.risks.every((entry) => entry.status === "high-risk"));
  const momentum = report.record.githubDevelopments.momentum!, witness = momentum.point!.security;
  assert.equal(witness.mode, "unavailable");
  if (witness.mode !== "unavailable") throw new Error("Unavailable risk witness required");
  assert.equal(witness.reason, "resource-limit");
  assert.deepEqual(witness.origin, { slot: original.slot, developmentRunId: original.id, availableAtUtc: original.availableAtUtc,
    configuration: original.configuration, policy: original.policy });
  assert.ok(Buffer.byteLength(JSON.stringify(witness)) <= 256 * 1024);
  assert.equal(momentum.point!.candidates.length, 20);
  assert.ok(momentum.nodes.every((entry) => entry.status === "unknown"));
  assert.deepEqual(momentum.capsules, []);
  assert.deepEqual(momentum.developments, []);
  assert.equal(report.record.github.watchItems.find((entry) => entry.nodeId === "repeat")!.starsDelta, 100);
  assert.ok(report.record.githubRepromotion.selectedNodeIds.includes("repeat"));
  assert.ok(report.record.githubRepromotion.selectedNodeIds.some((nodeId) => nodeId.startsWith("peer-")));
  assert.equal(report.record.githubRepromotion.reportedDevelopments.filter((entry) => entry.kind === "security").length, 4);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});
