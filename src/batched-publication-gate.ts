import { editionNames } from "./contracts.ts";
import type { CandidateV2, GateDecision } from "./gate-contracts.ts";
import { evaluatePublication, inputDigest, type EvaluationOptions } from "./publication-gate.ts";

export async function evaluateBatchedPublication(options: EvaluationOptions) {
  const batches: CandidateV2[][] = [];
  for (const edition of Object.keys(editionNames)) {
    let batch: CandidateV2[] = [];
    let claimCount = 0;
    for (const story of options.stories.filter((story) => story.edition === edition)) {
      if (claimCount + story.claims.length > 500) { batches.push(batch); batch = []; claimCount = 0; }
      batch.push(story);
      claimCount += story.claims.length;
    }
    if (batch.length) batches.push(batch);
  }
  if (batches.length > 30) throw new Error("verification-capacity-exceeded");
  const results: Array<Awaited<ReturnType<typeof evaluatePublication>>> = [];
  for (const [index, stories] of batches.entries()) {
    // evaluatePublication rechecks the model policy/TTL immediately before every send.
    // Hashing keeps derived task IDs within the existing 200-character identity limit.
    const taskId = `verification-${inputDigest([options.request.taskId, index])}`;
    results.push(await evaluatePublication({ ...options, request: { ...options.request, taskId }, stories, structuralStories: options.stories }));
  }
  const completedAtUtc = results.at(-1)?.completedAtUtc ?? options.clock();
  const decisions = results.flatMap((result) => result.publicationGate.decisions).map((decision): GateDecision => {
    if (decision.outcome === "quarantined") return decision;
    const claim = options.stories.find((story) => story.id === decision.storyId)!.claims.find((claim) => claim.id === decision.claimId)!;
    const reason = options.publicationPolicyCheck(claim.evidenceIds, claim, completedAtUtc);
    return reason ? { ...decision, outcome: "quarantined", reason,
      policy: { status: "failed", reason }, semantic: { status: "not-evaluated", reason: "policy-failed" } } : decision;
  });
  const outcome = (storyId: string, claimId: string) => decisions.find((decision) => decision.storyId === storyId && decision.claimId === claimId)?.outcome;
  const stories = results.flatMap((result) => result.stories).flatMap((story) => {
    const claims = story.claims.filter((claim) => outcome(story.id, claim.id) === "published");
    return claims.length ? [{ ...story, claims, title: claims.find((claim) => claim.kind === "fact")?.text ?? "陈述级核验" }] : [];
  });
  const receipts = results.map(({ publicationGate: { schemaVersion, input, verification, checkedAtUtc } }) => ({ schemaVersion, input, verification, checkedAtUtc }));
  const identity = { taskId: options.request.taskId, evidenceBundleId: options.request.evidenceBundle.id, configurationId: options.request.configurationId };
  return { stories, completedAtUtc, publicationGate: {
    schemaVersion: 2 as const, checkedAtUtc: completedAtUtc, decisions,
    // This is a coordinator ledger, never a fabricated aggregate Verifier receipt.
    verification: null, batches: receipts,
    unconfirmedItems: results.flatMap((result) => result.publicationGate.unconfirmedItems).filter((item) => outcome(item.storyId, item.claimId) === "unconfirmed"),
    input: { ...identity, inputSha256: inputDigest({ schemaVersion: 2, ...identity, batchInputSha256s: receipts.map((receipt) => receipt.input.inputSha256) }),
      verificationEvidenceIds: [...new Set(receipts.flatMap((receipt) => receipt.input.verificationEvidenceIds))],
      ...(options.recordVerifierDispatch ? { dispatchedEvidenceIds: [...new Set(receipts.flatMap((receipt) => receipt.input.dispatchedEvidenceIds ?? []))] } : {}),
      evidence: options.request.evidenceBundle.evidence.map((evidence) => ({ evidenceId: evidence.id, sourceId: evidence.sourceId, sourceType: evidence.sourceType, retrievedAtUtc: evidence.retrievedAtUtc,
        ...("policyVersion" in evidence ? { policyVersion: evidence.policyVersion, policySha256: evidence.policySha256 } : {}),
      })),
    },
  } };
}
