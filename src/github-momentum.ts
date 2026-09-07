import { githubDigest } from "./github-adapter.ts";
import { MomentumCapsuleSchema, MomentumSnapshotSchema, type MomentumPoint, type MomentumCapsule, type MomentumSnapshot } from "./github-momentum-contracts.ts";

export const momentumRules = Object.freeze({ version: "observer-github-momentum-v1" as const, percentile: 0.975, minimum: 20, stars: 100, forks: 20, dayMs: 86400000 });
export function momentumNodeOrder(a: string, b: string) {
  const left = Array.from(a), right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) { const delta = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!; if (delta) return delta; }
  return left.length - right.length;
}
export function evaluateMomentum(point: MomentumPoint, nodeId: string) {
  const unknown = { status: "unknown" as const, reasons: ["github-momentum-input-incomplete"], stars: 0, forks: 0, starsPercentile: 0, forksPercentile: 0, context: "" };
  const target = point.candidates.find((entry) => entry.nodeId === nodeId);
  if (point.developmentConfiguration?.momentum !== true || !target || target.status !== "measured" || point.runReasons.length ||
    point.queries.some((entry) => entry.reason || entry.totalCount === null || entry.receivedCount < entry.totalCount) ||
    point.candidates.some((entry) => entry.status === "missing" || entry.status === "quarantined") || point.security.mode === "unavailable" ||
    point.security.mode === "observed" && point.security.nodes.some((entry) => entry.historyUnavailable || entry.risks.some((risk) => risk.status === "unknown" || risk.status === "withdrawn"))) return unknown;
  const valid = (entry: typeof target) => entry.status === "measured" && entry.current?.observation.createdAtUtc != null && entry.historical != null &&
    entry.current.observation.createdAtUtc <= entry.current.observation.observedAtUtc && entry.current.observation.observedAtUtc > entry.historical.observation.observedAtUtc;
  if (!valid(target)) return unknown;
  const age = (entry: typeof target) => { const days = (Date.parse(point.cutoffUtc) - Date.parse(entry.current!.observation.createdAtUtc!)) / momentumRules.dayMs; return days < 30 ? "0-29d" : days < 365 ? "30-364d" : "365d+"; };
  const measured = point.candidates.filter(valid);
  let fallback = "language-age", peers = measured.filter((entry) => age(entry) === age(target) && entry.current!.observation.language === target.current!.observation.language);
  if (peers.length < momentumRules.minimum) { fallback = "age"; peers = measured.filter((entry) => age(entry) === age(target)); }
  if (peers.length < momentumRules.minimum) { fallback = "partition"; peers = measured; }
  if (peers.length < momentumRules.minimum) return { ...unknown, reasons: ["github-momentum-minimum-sample"] };
  const signal = (entry: typeof target, kind: "stars" | "forks") => Math.max(0, entry.current!.observation[kind]! - entry.historical!.observation[kind]!) * momentumRules.dayMs /
    (Date.parse(entry.current!.observation.observedAtUtc) - Date.parse(entry.historical!.observation.observedAtUtc));
  const percentile = (value: number, values: number[]) => value <= 0 ? 0 : (values.filter((other) => other < value).length + values.filter((other) => other === value).length / 2) / values.length;
  const stars = signal(target, "stars"), forks = signal(target, "forks"), starsPercentile = percentile(stars, peers.map((entry) => signal(entry, "stars"))), forksPercentile = percentile(forks, peers.map((entry) => signal(entry, "forks")));
  const extreme = stars >= momentumRules.stars && starsPercentile >= momentumRules.percentile || forks >= momentumRules.forks && forksPercentile >= momentumRules.percentile;
  return { status: extreme ? "extreme" as const : "non-extreme" as const, reasons: [], stars, forks, starsPercentile, forksPercentile,
    context: githubDigest([point.rulesVersion, point.sampling, target.current!.observation.language, age(target), fallback, peers.map((entry) => entry.nodeId)]) };
}

function validPoint(point: MomentumPoint): boolean {
  const { id, ...metadata } = point;
  if (id !== githubDigest(metadata) || Buffer.byteLength(JSON.stringify(point)) > 1024 * 1024 || point.availableAtUtc > point.cutoffUtc ||
    point.security.mode === "disabled" && point.developmentConfiguration?.advisories === true ||
    point.security.mode === "observed" && githubDigest(point.security.nodes.map((entry) => entry.nodeId)) !== githubDigest(point.candidates.map((entry) => entry.nodeId)) ||
    point.security.origin !== null && (githubDigest(point.security.origin.configuration) !== githubDigest(point.developmentConfiguration) ||
      point.security.origin.slot !== point.slot || point.security.origin.availableAtUtc > point.cutoffUtc || githubDigest(point.security.origin.policy) !== githubDigest(point.policy)) ||
    point.githubRunId !== githubDigest([point.slot, point.configuration, point.policy]) ||
    new Set(point.candidates.map((entry) => entry.nodeId)).size !== point.candidates.length ||
    githubDigest(point.candidates.map((entry) => entry.nodeId)) !== githubDigest(point.candidates.map((entry) => entry.nodeId).sort(momentumNodeOrder))) return false;
  for (const candidate of point.candidates) for (const origin of [candidate.current, candidate.historical]) if (origin) {
    const { id: observationId, ...observation } = origin.observation;
    if (origin.githubRunId !== githubDigest([origin.slot, origin.configuration, origin.policy]) || observationId !== githubDigest([origin.githubRunId, observation]) ||
      observation.nodeId !== candidate.nodeId || observation.availableAtUtc > point.cutoffUtc || observation.observedAtUtc > observation.availableAtUtc) return false;
  }
  return true;
}
export function capsuleDevelopment(input: MomentumCapsule) {
  const capsule = MomentumCapsuleSchema.parse(input), { id, ...metadata } = capsule;
  if (id !== githubDigest(metadata) || Buffer.byteLength(JSON.stringify(capsule)) > 8 * 1024 * 1024 || capsule.points.some((point) => !validPoint(point)) ||
    capsule.points.some((point, index) => index > 0 && point.slot <= capsule.points[index - 1]!.slot)) throw new Error("github-momentum-proof-invalid");
  const last = capsule.points.at(-1)!, target = last.candidates.find((entry) => entry.nodeId === capsule.nodeId);
  if (target?.current?.observation.id !== capsule.onsetObservationId || evaluateMomentum(last, capsule.nodeId).status !== "extreme") throw new Error("github-momentum-proof-invalid");
  if (capsule.kind === "startup") {
    if (capsule.points.length > 28 || capsule.points.slice(0, -1).some((point) => evaluateMomentum(point, capsule.nodeId).status === "extreme")) throw new Error("github-momentum-proof-invalid");
  } else {
    const low = capsule.points.slice(0, -1), context = evaluateMomentum(last, capsule.nodeId).context;
    const observed = (point: MomentumPoint) => Date.parse(point.candidates.find((entry) => entry.nodeId === capsule.nodeId)!.current!.observation.observedAtUtc);
    if (low.length < 2 || low.length > 28 || low.some((point) => evaluateMomentum(point, capsule.nodeId).status !== "non-extreme" || evaluateMomentum(point, capsule.nodeId).context !== context) ||
      observed(low.at(-1)!) - observed(low[0]!) < momentumRules.dayMs || capsule.points.some((point, index) => index > 0 &&
        (observed(point) <= observed(capsule.points[index - 1]!) || observed(point) - observed(capsule.points[index - 1]!) > 90 * 60000))) throw new Error("github-momentum-proof-invalid");
  }
  const eventId = githubDigest([capsule.nodeId, "momentum", capsule.onsetObservationId]);
  return { nodeId: capsule.nodeId, kind: "momentum" as const, eventId, developmentId: githubDigest([eventId, "initial-exceptional-momentum"]),
    revisionId: githubDigest([eventId, "initial-exceptional-momentum", "revision-v1"]), observationId: capsule.onsetObservationId, capsuleId: capsule.id, materialRevision: "initial-exceptional-momentum" as const };
}
export function reconstructMomentum(input: MomentumSnapshot) {
  const snapshot = MomentumSnapshotSchema.parse(input);
  if (snapshot.point && (!validPoint(snapshot.point) || snapshot.point.availableAtUtc > snapshot.cutoffUtc || snapshot.freeze.pointId !== snapshot.point.id || snapshot.freeze.pointSlot !== snapshot.point.slot) ||
    snapshot.capsules.length > 50 || Buffer.byteLength(JSON.stringify(snapshot.capsules)) > 32 * 1024 * 1024) throw new Error("github-momentum-proof-invalid");
  const available = snapshot.capsules.map(capsuleDevelopment);
  return snapshot.nodes.flatMap((node) => {
    if (!snapshot.point || node.status !== evaluateMomentum(snapshot.point, node.nodeId).status) throw new Error("github-momentum-proof-invalid");
    if (node.status !== "extreme" || !node.capsuleId || node.reasons.includes("github-momentum-resource-limit")) return [];
    const found = available.find((entry) => entry.nodeId === node.nodeId && entry.capsuleId === node.capsuleId && entry.observationId === node.onsetObservationId);
    return found ? [found] : [];
  });
}
