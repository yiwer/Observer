import { randomUUID } from "node:crypto";
import { AgentResultSchema, ProduceRequestSchema, editionNames, type AgentResult, type AgentRunner, type AgentRunOptions, type EditionResearch, type SixEditionRequest } from "./contracts.ts";
import { VerificationSchema, type SemanticVerifier, type VerificationInput, type Verification, type Claim } from "./gate-contracts.ts";
import { inputDigest } from "./publication-gate.ts";
import { ProviderEligibilitySchema, RoutingConfigurationSchema, RoutingResponseUsageSchema, type Provider, type RoutingReceipt } from "./routing-contracts.ts";
import { readTrustedSemanticRun } from "./semantic-verifiers.ts";

type Edition = keyof typeof editionNames;
function assessmentDecision(assessment: Verification["assessments"][number]) {
  return { ...assessment, evidence: [...assessment.evidence].sort((a, b) => a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0) };
}
function validVerification(value: unknown, context: VerificationInput): Verification | undefined {
  const parsed = VerificationSchema.safeParse(value);
  const expected = context.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claim })));
  if (!parsed.success || parsed.data.inputSha256 !== context.inputSha256 || parsed.data.assessments.length !== expected.length ||
    !expected.every(({ storyId, claim }) => {
      const matches = parsed.data.assessments.filter((entry) => entry.storyId === storyId && entry.claimId === claim.id);
      return matches.length === 1 && !matches[0]!.eventProjection && !matches[0]!.selectionProjection && !matches[0]!.domainProjection &&
        matches[0]!.evidence.length === claim.evidenceIds.length && new Set(matches[0]!.evidence.map((entry) => entry.evidenceId)).size === claim.evidenceIds.length && matches[0]!.evidence.every((entry) => claim.evidenceIds.includes(entry.evidenceId));
    })) return undefined;
  return parsed.data;
}
export interface RoutingOptions {
  executionScope?: "protocol-fixture" | "live";
  configuration: unknown;
  eligibility(): unknown;
  providers: Partial<Record<Provider, { editions: Partial<Record<Edition, AgentRunner>>; verifier: SemanticVerifier }>>;
  clock?: () => string;
}
interface AssemblyState { cleanupUnverified: boolean; active: number; waiters: Set<() => void>; externalActive: number; externalWaiters: Set<() => void>; maxProcesses: number; maxExternal: number }
const assemblyStates = new WeakMap<RoutingOptions, AssemblyState>();
export class RoutingBoundaryError extends Error {}
// Each binding owns its identity and ledger; it never discovers a run via a mutable latest-run pointer.
export function createProviderRouting(options: RoutingOptions, task: SixEditionRequest, persist: (receipt: RoutingReceipt) => void,
  collection: () => RoutingReceipt["collection"], authorizeEvidence: (evidenceIds: string[]) => void, initialSignal?: AbortSignal) {
  const configuration = RoutingConfigurationSchema.parse(options.configuration), clock = options.clock ?? (() => new Date().toISOString());
  const deadline = performance.now() + configuration.limits.totalTimeoutMs;
  const remaining = () => Math.max(0, deadline - performance.now());
  let assembly = assemblyStates.get(options);
  if (!assembly) { assembly = { cleanupUnverified: false, active: 0, waiters: new Set(), externalActive: 0, externalWaiters: new Set(), maxProcesses: configuration.limits.maxConcurrentProcesses, maxExternal: configuration.limits.maxConcurrentExternalRequests }; assemblyStates.set(options, assembly); }
  const authorizeAssembly = () => {
    if (assembly.maxProcesses !== configuration.limits.maxConcurrentProcesses || assembly.maxExternal !== configuration.limits.maxConcurrentExternalRequests) throw new RoutingBoundaryError("assembly-configuration-changed");
  };
  const acquireProcess = async (signal?: AbortSignal) => {
    while (assembly.active >= assembly.maxProcesses) {
      if (assembly.cleanupUnverified || signal?.aborted || !remaining()) throw new Error("execution-unavailable");
      await new Promise<void>((resolve) => {
        const wake = () => { clearTimeout(timer); signal?.removeEventListener("abort", wake); assembly.waiters.delete(wake); resolve(); };
        const timer = setTimeout(wake, remaining());
        assembly.waiters.add(wake); signal?.addEventListener("abort", wake, { once: true });
      });
    }
    if (assembly.cleanupUnverified || signal?.aborted || !remaining()) throw new Error("execution-unavailable");
    assembly.active++;
    let released = false;
    return () => { if (released) return; released = true; assembly.active--; for (const wake of assembly.waiters) wake(); };
  };
  const receipt: RoutingReceipt = { schemaVersion: 1, rules: "observer-routing-v1", runId: `run-${randomUUID()}`, taskId: task.taskId, evidenceBundleId: task.evidenceBundle.id, configurationId: task.configurationId,
    configuration, configurationSha256: inputDigest(configuration), externalRequests: 0, qualifications: [], qualificationOverflow: null, usageProtection: { observedTokens: "0", unknownAttempts: 0, accounting: "not-observed", thresholdReached: false, exceeded: false }, collection: collection(), outcome: "pending", decisions: [], reviews: [], attempts: [], status: "running", reportVersionId: null, failureReason: null };
  const escapedId = "\u0001".repeat(200), maximumHash = "f".repeat(64);
  // Bound the complete remaining writer vocabulary, including escaped failure/terminal
  // fields. Decision Editions are the fixed Edition enum, never arbitrary model text.
  const administrativeBytes = 84 * (5 + 8 * 3) * 64 + Buffer.byteLength(JSON.stringify({ ...receipt, status: "published", reportVersionId: escapedId, failureReason: escapedId,
    outcome: "agents-unavailable-collection-unavailable", externalRequests: 672,
    usageProtection: { observedTokens: "9".repeat(20), unknownAttempts: 84, accounting: "not-observed", thresholdReached: false, exceeded: false },
    collection: { status: "unavailable", linkEvidenceIds: task.evidenceBundle.evidence.map((entry) => entry.id) }, reviews: [],
    qualifications: Array(16).fill({ provider: "claude", version: Number.MAX_SAFE_INTEGER, enabled: false, accountEligible: false, regionEligible: false, scope: "protocol-fixture", checkedAtUtc: clock(), validUntilUtc: clock(), evidenceReference: escapedId, configurationSha256: maximumHash }),
    qualificationOverflow: { provider: "claude", version: Number.MAX_SAFE_INTEGER, enabled: false, accountEligible: false, regionEligible: false, scope: "protocol-fixture", checkedAtUtc: clock(), validUntilUtc: clock(), evidenceReference: escapedId, configurationSha256: maximumHash },
    decisions: Array(512).fill({ sequence: 512, edition: "frontier-technology", provider: "claude", state: "request-budget-exhausted", atUtc: clock() }),
    attempts: Array(84).fill({ id: escapedId, edition: "frontier-technology", role: "verification", provider: "claude", status: "succeeded", inputSha256: maximumHash, qualificationSha256: maximumHash,
      execution: { provenance: "protocol-fixture", processKind: "protocol-fixture", modelTransport: "model-protocol-fixture", cliVersion: escapedId, durationMs: Number.MAX_SAFE_INTEGER, exitCode: -Number.MAX_SAFE_INTEGER, terminal: "completed", containerId: maximumHash, cleanup: "not-created" }, usageSource: "model-responses",
      observedResponses: Array(8).fill({ request: 8, inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: Number.MAX_SAFE_INTEGER, costUsd: Number.MAX_VALUE }),
      startedAtUtc: clock(), finishedAtUtc: clock(), reason: escapedId, modelRequests: 8, usage: { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: Number.MAX_SAFE_INTEGER, costUsd: Number.MAX_VALUE } }),
  }));
  const save = () => {
    const observed = receipt.attempts.reduce((total, attempt) => total + (["inputTokens", "outputTokens"] as const).reduce((sum, key) => {
      const responses = attempt.observedResponses.reduce((value, entry) => value + BigInt(entry[key] ?? 0), 0n), final = BigInt(attempt.usage[key] ?? 0);
      return sum + (responses > final ? responses : final);
    }, 0n), 0n);
    const unknownAttempts = receipt.attempts.filter((attempt) => (attempt.usage.inputTokens === null || attempt.usage.outputTokens === null) &&
      (!attempt.modelRequests || attempt.observedResponses.length !== attempt.modelRequests || attempt.observedResponses.some((entry) => entry.inputTokens === null || entry.outputTokens === null))).length;
    receipt.usageProtection = { observedTokens: observed.toString(), unknownAttempts, accounting: !receipt.attempts.length ? "not-observed" : unknownAttempts ? "incomplete" : "complete",
      thresholdReached: observed >= BigInt(configuration.limits.maxObservedTokens), exceeded: observed > BigInt(configuration.limits.maxObservedTokens) };
    persist(structuredClone(receipt));
  };
  save();
  const decide = (edition: Edition, provider: Provider | null, state: RoutingReceipt["decisions"][number]["state"]) => {
    receipt.decisions.push({ sequence: receipt.decisions.length + 1, edition, provider, state, atUtc: clock() }); save();
  };
  const isolatedProviders = new Set<Provider>();
  const latestQualification = new Map<Provider, string>();
  const qualificationEligible = (provider: Provider) => {
    if (receipt.qualificationOverflow) throw new RoutingBoundaryError("qualification-capacity-exceeded");
    const values = ProviderEligibilitySchema.array().max(2).parse(options.eligibility());
    const matching = values.filter((entry) => entry.provider === provider), now = clock();
    if (matching.length === 1) {
      const grant = matching[0]!, configurationSha256 = inputDigest(grant);
      if (!receipt.qualifications.some((entry) => entry.configurationSha256 === configurationSha256)) {
        if (receipt.status !== "running") throw new RoutingBoundaryError("qualification-changed");
        if (receipt.qualifications.length >= 16) {
          // Denial evidence is deliberately outside the authorizing grant set.
          receipt.qualificationOverflow = { ...grant, configurationSha256 }; save();
          throw new RoutingBoundaryError("qualification-capacity-exceeded");
        }
        receipt.qualifications.push({ ...grant, configurationSha256 }); save();
      }
      latestQualification.set(provider, configurationSha256);
    }
    return matching.length === 1 && matching[0]!.enabled && matching[0]!.accountEligible && matching[0]!.regionEligible && matching[0]!.checkedAtUtc <= now && matching[0]!.validUntilUtc > now && matching[0]!.scope === (options.executionScope ?? "protocol-fixture");
  };
  const eligible = (provider: Provider) => !isolatedProviders.has(provider) && qualificationEligible(provider);
  const selected = new Map<Edition, Provider>();
  const withdrawn = new Set<Edition>();
  const roleAvailable = (role: "research" | "verification" | "review") => receipt.attempts.filter((entry) => entry.role === role).length <
    configuration.limits[role === "research" ? "maxResearchAttempts" : role === "verification" ? "maxVerificationAttempts" : "maxReviewAttempts"];
  const attemptEvidence = new Map<string, string[]>();
  const attemptAborters = new Map<string, () => void>();
  let ownerSignal: AbortSignal | undefined = initialSignal;
  const begin = (edition: Edition, role: "research" | "verification" | "review", input: unknown, provider: Provider, evidenceIds: string[]) => {
    if (receipt.usageProtection.thresholdReached) { decide(edition, provider, "usage-budget-exhausted"); throw new RoutingBoundaryError("usage-budget-exhausted"); }
    if (assembly.cleanupUnverified) throw new Error("cleanup-unverified");
    if (!remaining()) throw new Error("total-deadline");
    if (!roleAvailable(role)) { decide(edition, provider, "attempt-budget-exhausted"); throw new RoutingBoundaryError("attempt-budget-exhausted"); }
    if (!eligible(provider)) throw new Error("provider-ineligible");
    authorizeEvidence(evidenceIds);
    const id = `route-${inputDigest([receipt.runId, task.taskId, edition, role, provider, receipt.attempts.length])}`;
    const attempt: RoutingReceipt["attempts"][number] = { id, edition, role, provider, inputSha256: inputDigest(input), qualificationSha256: latestQualification.get(provider)!, status: "started", startedAtUtc: clock(), finishedAtUtc: null, reason: null, modelRequests: 0, execution: null, usageSource: "unknown", observedResponses: [], usage: { inputTokens: null, outputTokens: null, costUsd: null } };
    attemptEvidence.set(id, [...evidenceIds]); receipt.attempts.push(attempt); save(); return attempt;
  };
  const dispatchControl = (attempt: RoutingReceipt["attempts"][number]): NonNullable<AgentRunOptions["dispatchControl"]> => ({
    observeUsage(request, usage) {
      if (receipt.status !== "running" || attempt.status !== "started") return;
      const observation = RoutingResponseUsageSchema.parse({ request, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd });
      if (request > attempt.modelRequests) throw new RoutingBoundaryError("invalid-usage-request");
      const previous = attempt.observedResponses.find((entry) => entry.request === request);
      // First observation is immutable, including unknown fields. Equal repeats are idempotent.
      if (previous) { if (inputDigest(previous) !== inputDigest(observation)) throw new RoutingBoundaryError("conflicting-usage-observation"); return; }
      attempt.observedResponses.push(observation); save();
      if (receipt.usageProtection.thresholdReached) attemptAborters.get(attempt.id)?.();
    },
    async dispatch(send, signal) {
      if (receipt.status !== "running" || attempt.status !== "started") throw new RoutingBoundaryError("dispatch-forbidden");
      while (assembly.externalActive >= assembly.maxExternal) {
        if (receipt.status !== "running" || attempt.status !== "started" || signal.aborted || !remaining() || assembly.cleanupUnverified) throw new RoutingBoundaryError("dispatch-forbidden");
        await new Promise<void>((resolve) => {
          const wake = () => { clearTimeout(timer); signal.removeEventListener("abort", wake); assembly.externalWaiters.delete(wake); resolve(); };
          const timer = setTimeout(wake, remaining());
          assembly.externalWaiters.add(wake); signal.addEventListener("abort", wake, { once: true });
        });
      }
      if (receipt.status !== "running" || attempt.status !== "started" || signal.aborted || !remaining() || assembly.cleanupUnverified || !eligible(attempt.provider)) throw new RoutingBoundaryError("dispatch-forbidden");
      if (attempt.modelRequests >= configuration.limits.maxModelRequestsPerAttempt || receipt.externalRequests >= configuration.limits.maxExternalRequests) throw new RoutingBoundaryError("request-budget-exhausted");
      if (receipt.usageProtection.thresholdReached) throw new RoutingBoundaryError("usage-budget-exhausted");
      authorizeEvidence(attemptEvidence.get(attempt.id)!);
      assembly.externalActive++;
      try { attempt.modelRequests++; receipt.externalRequests++; save(); return await send(); }
      finally { assembly.externalActive--; for (const wake of assembly.externalWaiters) wake(); }
    },
  });
  const semanticAttempt = async (input: VerificationInput, edition: Edition, role: "verification" | "review", provider: Provider) => {
    if (role === "verification") {
      const potentialReviews = input.stories.flatMap((story) => story.claims.map((claim) => ({ inputSha256: maximumHash, storyId: story.id, claimId: claim.id, inputClaimSha256: maximumHash,
        primaryProvider: "claude", reviewProvider: "claude", primaryAssessmentSha256: maximumHash, reviewAssessmentSha256: maximumHash, outcome: "review-unavailable" })));
      const reviewBytes = [...receipt.reviews, ...potentialReviews].reduce((bytes, entry) => bytes + Buffer.byteLength(JSON.stringify(entry)) + 1, 0);
      if (administrativeBytes + reviewBytes > configuration.limits.maxAuditBytes || receipt.reviews.length + potentialReviews.length > 15000) {
        decide(edition, provider, "audit-budget-exhausted"); throw new RoutingBoundaryError("audit-budget-exhausted");
      }
    }
    const release = await acquireProcess(ownerSignal);
    let attempt: RoutingReceipt["attempts"][number] | undefined;
    const cancellation = new AbortController();
    const signal = ownerSignal ? AbortSignal.any([ownerSignal, cancellation.signal]) : cancellation.signal;
    const timer = setTimeout(() => cancellation.abort(), Math.min(configuration.limits.attemptTimeoutMs, remaining()));
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let onAbort = () => {};
    const cleanupBoundary = new Promise<never>((_resolve, reject) => {
      onAbort = () => { cleanupTimer = setTimeout(() => { assembly.cleanupUnverified = true; reject(new RoutingBoundaryError("cleanup-unverified")); }, configuration.limits.cleanupTimeoutMs); };
      signal.addEventListener("abort", onAbort, { once: true }); if (signal.aborted) onAbort();
    });
    try {
      if (signal.aborted) throw new RoutingBoundaryError("cancelled");
      attempt = begin(edition, role, input, provider, input.evidence.map((entry) => entry.id));
      attemptAborters.set(attempt.id, () => cancellation.abort());
      const verifier = options.providers[provider]?.verifier;
      if (!verifier) throw new RoutingBoundaryError("verifier-unavailable");
      let result = await Promise.race([verifier.verify(structuredClone(input), { signal, dispatchControl: dispatchControl(attempt), semanticAttempt: { id: attempt.id, inputSha256: input.inputSha256 } }), cleanupBoundary]);
      const host = readTrustedSemanticRun(result);
      if (options.executionScope === "live" && (!host || host.execution?.provenance !== `${provider}-cli` || host.execution.processKind !== `${provider}-cli` || host.execution.modelTransport !== (provider === "codex" ? "openai-api" : "anthropic-api"))) throw new RoutingBoundaryError("live-semantic-execution-required");
      if (host) {
        attempt.execution = host.execution ?? null; attempt.usageSource = host.usage?.source ?? "unknown";
        attempt.usage = { inputTokens: host.usage?.inputTokens ?? null, outputTokens: host.usage?.outputTokens ?? null, costUsd: host.usage?.costUsd ?? null };
        if (host.execution?.cleanup === "unverified" || host.status !== "succeeded" && host.failure.category === "cleanup-failed") assembly.cleanupUnverified = true;
        if (host.taskId !== attempt.id || host.inputSha256 !== input.inputSha256 || host.provider !== provider || host.model !== (provider === "codex" ? "gpt-5.6-sol" : "claude-sonnet-4-6") || host.evidenceBundleId !== input.evidenceBundleId || host.configurationId !== input.configurationId) throw new RoutingBoundaryError("invalid-semantic-binding");
        if (assembly.cleanupUnverified) throw new RoutingBoundaryError("cleanup-unverified");
        if (host.status !== "succeeded" && host.failure.category === "policy-violation") { isolatedProviders.add(provider); decide(edition, provider, "provider-isolated"); }
        if (host.status !== "succeeded") throw new RoutingBoundaryError(host.failure.category);
        result = host.verification;
      }
      if (receipt.usageProtection.thresholdReached) throw new RoutingBoundaryError("usage-budget-exhausted");
      if (ownerSignal?.aborted) throw new RoutingBoundaryError("cancelled");
      if (!remaining()) throw new RoutingBoundaryError("total-deadline");
      if (signal.aborted) throw new RoutingBoundaryError("timeout");
      if (!eligible(provider)) throw new RoutingBoundaryError("provider-ineligible");
      authorizeEvidence(attemptEvidence.get(attempt.id)!);
      const valid = validVerification(result, input);
      attempt.status = valid ? "succeeded" : "failed"; attempt.reason = valid ? null : "invalid-output"; attempt.finishedAtUtc = clock(); save();
      return { result, attempt };
    } catch (error) {
      if (attempt) { attempt.status = "failed"; attempt.reason = receipt.usageProtection.thresholdReached ? "usage-budget-exhausted" : error instanceof RoutingBoundaryError ? error.message : "unknown"; attempt.finishedAtUtc = clock(); save(); }
      throw error;
    } finally {
      clearTimeout(timer); if (cleanupTimer) clearTimeout(cleanupTimer); signal.removeEventListener("abort", onAbort);
      if (attempt) attemptAborters.delete(attempt.id);
      if (!assembly.cleanupUnverified) release();
      else for (const wake of [...assembly.waiters, ...assembly.externalWaiters]) wake();
    }
  };
  return {
    receipt: () => structuredClone(receipt),
    publicationFailure(edition: Edition): string | null {
      if (withdrawn.has(edition)) return "provider-ineligible";
      const provider = selected.get(edition);
      if (provider && !qualificationEligible(provider)) {
        withdrawn.add(edition); selected.delete(edition);
        decide(edition, provider, "provider-disabled");
        return "provider-ineligible";
      }
      return null;
    },
    freeze() { receipt.status = "ready"; receipt.collection = collection(); receipt.outcome = selected.size ? "research-available" : `agents-unavailable-collection-${receipt.collection.status}`; save(); return structuredClone(receipt); },
    authorize(hasPublishedContent = false) {
      authorizeAssembly();
      if (receipt.qualificationOverflow) throw new RoutingBoundaryError("qualification-capacity-exceeded");
      if (ownerSignal?.aborted) throw new RoutingBoundaryError("cancelled");
      if (hasPublishedContent && !remaining()) throw new RoutingBoundaryError("total-deadline");
      if ([...selected.values()].some((provider) => !qualificationEligible(provider))) throw new Error("provider-ineligible");
    },
    complete(reportVersionId: string | null, failureReason: string | null = null) { receipt.status = reportVersionId ? "published" : "failed"; receipt.reportVersionId = reportVersionId; receipt.failureReason = failureReason; save(); },
    reviewDecision(storyId: string, claim: Claim): { outcome: "unconfirmed" | "quarantined"; reason: string } | null {
      const review = receipt.reviews.find((entry) => entry.storyId === storyId && entry.claimId === claim.id && entry.inputClaimSha256 === inputDigest(claim));
      if (review?.outcome === "disputed") return { outcome: "unconfirmed", reason: "provider-review-disagreement" };
      if (review?.outcome === "invalid-review") return { outcome: "quarantined", reason: "invalid-provider-review" };
      if (review?.outcome === "unsafe-review") return { outcome: "quarantined", reason: "unsafe-provider-review" };
      return null;
    },
    async run(input: SixEditionRequest, runOptions?: { signal?: AbortSignal }): Promise<EditionResearch> {
      authorizeAssembly();
      ownerSignal = runOptions?.signal;
      if (runOptions?.signal?.aborted) throw new Error("cancelled");
      const results: EditionResearch["editions"] = [];
      for (const edition of Object.keys(editionNames) as Edition[]) {
        decide(edition, null, "queued");
        const assigned = input.editions.find((entry) => entry.edition === edition)!;
        if (!assigned.evidenceIds.length) { results.push({ edition, status: "no-evidence" }); decide(edition, null, "no-evidence"); continue; }
        const backup: Provider = configuration.primary === "codex" ? "claude" : "codex";
        const providers: Provider[] = [configuration.primary, backup];
        const retries = new Map<Provider, number>();
        for (const [providerIndex, provider] of providers.entries()) {
        if (receipt.usageProtection.thresholdReached) { decide(edition, null, "usage-budget-exhausted"); break; }
        if (!roleAvailable("research")) { decide(edition, null, "attempt-budget-exhausted"); break; }
        if (administrativeBytes > configuration.limits.maxAuditBytes) { decide(edition, null, "audit-budget-exhausted"); break; }
        if (receipt.externalRequests >= configuration.limits.maxExternalRequests) { decide(edition, null, "request-budget-exhausted"); break; }
        if (assembly.cleanupUnverified) { decide(edition, null, "cleanup-unverified"); break; }
        if (!remaining()) { decide(edition, null, "deadline-exhausted"); break; }
        if (!eligible(provider)) { decide(edition, provider, "provider-disabled"); continue; }
        const runner = options.providers[provider]?.editions[edition];
        if (!runner) { decide(edition, provider, "runner-unavailable"); continue; }
        let release: () => void;
        try { release = await acquireProcess(runOptions?.signal); }
        catch { if (runOptions?.signal?.aborted) throw new Error("cancelled"); decide(edition, null, assembly.cleanupUnverified ? "cleanup-unverified" : "deadline-exhausted"); break; }
        try {
        if (!eligible(provider)) { release(); decide(edition, provider, "provider-disabled"); continue; }
        decide(edition, provider, provider === providers[0] ? "primary-selected" : "fallback-selected");
        const attempt = begin(edition, "research", { ...input, edition, evidenceIds: assigned.evidenceIds }, provider, assigned.evidenceIds);
        const external = { schemaVersion: 1 as const, taskId: attempt.id, configurationId: input.configurationId, businessDate: input.businessDate,
          evidenceBundle: { ...input.evidenceBundle, evidence: input.evidenceBundle.evidence.filter((entry) => assigned.evidenceIds.includes(entry.id)) } };
        let result: AgentResult | undefined;
        const cancellation = new AbortController();
        attemptAborters.set(attempt.id, () => cancellation.abort());
        const timer = setTimeout(() => cancellation.abort(), Math.min(configuration.limits.attemptTimeoutMs, remaining()));
        const signal = runOptions?.signal ? AbortSignal.any([runOptions.signal, cancellation.signal]) : cancellation.signal;
        let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
        let cleanupUnverified = false;
        let onAbort = () => {};
        const cleanupBoundary = new Promise<never>((_resolve, reject) => {
          onAbort = () => { cleanupTimer = setTimeout(() => {
            cleanupUnverified = true; assembly.cleanupUnverified = true;
            reject(new Error("cleanup-unverified"));
          }, configuration.limits.cleanupTimeoutMs); };
          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
        try {
          result = AgentResultSchema.parse(await Promise.race([runner.run(ProduceRequestSchema.parse(external), { signal, dispatchControl: dispatchControl(attempt) }), cleanupBoundary]));
          attempt.execution = result.execution ?? null;
          attempt.usageSource = result.usage?.source ?? "unknown";
          if (result.execution?.cleanup === "unverified" || result.status !== "succeeded" && result.failure.category === "cleanup-failed") assembly.cleanupUnverified = true;
          if (result.taskId !== attempt.id || result.provider !== attempt.provider || result.model !== (attempt.provider === "codex" ? "gpt-5.6-sol" : "claude-sonnet-4-6") || result.evidenceBundleId !== input.evidenceBundle.id || result.configurationId !== input.configurationId ||
            result.status === "succeeded" && result.stories.some((story) => story.schemaVersion !== 2 || story.edition !== edition || story.claims.some((claim) => claim.evidenceIds.some((id) => !assigned.evidenceIds.includes(id))))) throw new RoutingBoundaryError("invalid-output");
          if (!eligible(attempt.provider)) throw new RoutingBoundaryError("provider-ineligible");
        }
        catch (error) {
          if (result) attempt.usage = { inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null, costUsd: result.usage?.costUsd ?? null };
          attempt.status = "failed"; attempt.reason = cleanupUnverified ? "cleanup-unverified" : receipt.usageProtection.thresholdReached ? "usage-budget-exhausted" : !remaining() ? "total-deadline" : cancellation.signal.aborted ? "timeout" : error instanceof RoutingBoundaryError ? error.message : "unknown"; attempt.finishedAtUtc = clock(); save();
          if (runOptions?.signal?.aborted) throw new Error("cancelled");
          if (provider === configuration.primary && eligible(backup)) continue;
          results.push({ edition, status: "invalid-output" }); break;
        } finally {
          clearTimeout(timer); if (cleanupTimer) clearTimeout(cleanupTimer); signal.removeEventListener("abort", onAbort);
          attemptAborters.delete(attempt.id);
          if (!assembly.cleanupUnverified) release();
          else for (const wake of assembly.waiters) wake();
        }
        authorizeEvidence(attemptEvidence.get(attempt.id)!);
        if (result.execution?.cleanup === "unverified" || result.status !== "succeeded" && result.failure.category === "cleanup-failed") assembly.cleanupUnverified = true;
        const reason = assembly.cleanupUnverified ? "cleanup-unverified" : runOptions?.signal?.aborted ? "cancelled" : receipt.usageProtection.thresholdReached ? "usage-budget-exhausted" : !remaining() ? "total-deadline" : cancellation.signal.aborted ? "timeout" : result.status === "succeeded" ? null : result.failure.category;
        attempt.status = reason ? "failed" : "succeeded"; attempt.finishedAtUtc = clock();
        attempt.reason = reason;
        attempt.usage = { inputTokens: result.usage?.inputTokens ?? null, outputTokens: result.usage?.outputTokens ?? null, costUsd: result.usage?.costUsd ?? null }; save();
        if (reason === "policy-violation") { isolatedProviders.add(provider); decide(edition, provider, "provider-isolated"); }
        if (reason === "cancelled") throw new Error("cancelled");
        if (reason === "unavailable" && (retries.get(provider) ?? 0) < configuration.limits.sameProviderRetries && eligible(provider) && remaining()) {
          retries.set(provider, (retries.get(provider) ?? 0) + 1); providers.splice(providerIndex + 1, 0, provider); decide(edition, provider, "provider-retry"); continue;
        }
        if (reason && provider === configuration.primary && ["unavailable", "timeout", "nonzero-exit", "invalid-output", "version-mismatch", "output-limit", "policy-violation"].includes(reason) && eligible(backup)) continue;
        if (reason && result.status === "succeeded") { results.push({ edition, status: "invalid-output" }); break; }
        const projected = { ...result, taskId: `${input.taskId}:${edition}` };
        // The preceding strict parsing and Claim v2 membership check authorize only this envelope projection.
        results.push({ edition, status: "completed", result: projected } as EditionResearch["editions"][number]);
        if (result.status === "succeeded") selected.set(edition, provider);
        decide(edition, provider, result.status === "succeeded" ? "research-completed" : "research-failed");
        break;
        } finally { if (!assembly.cleanupUnverified) release(); }
        }
        if (!results.some((entry) => entry.edition === edition)) { results.push({ edition, status: "invalid-output" }); decide(edition, null, "research-failed"); }
      }
      return { schemaVersion: 2, taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId, editions: results };
    },
    async verify(input: VerificationInput): Promise<unknown> {
      const edition = input.stories[0]!.edition;
      if (input.stories.some((story) => story.edition !== edition)) throw new Error("mixed-edition-verification");
      const researchProvider = selected.get(edition) ?? configuration.primary;
      const verifierProvider = eligible(researchProvider) ? researchProvider : researchProvider === "codex" ? "claude" : "codex";
      const { result, attempt } = await semanticAttempt(input, edition, "verification", verifierProvider);
      const valid = validVerification;
      const primary = valid(result, input);
      if (!primary) return result; // The existing Gate rejects the actual malformed primary receipt.
      const targets = primary.assessments.filter((entry) => entry.domain?.risk.level === "high" || entry.conclusion === "conflicting" || entry.evidence.some((evidence) => evidence.relation === "contradicts"));
      if (!targets.length) return result;
      const other: Provider = attempt.provider === "codex" ? "claude" : "codex";
      const stories = input.stories.flatMap((story) => {
        const claims = story.claims.filter((claim) => targets.some((entry) => entry.storyId === story.id && entry.claimId === claim.id));
        return claims.length ? [{ ...story, claims }] : [];
      });
      const evidenceIds = new Set(stories.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)));
      const context = { schemaVersion: 1 as const, taskId: `review-${inputDigest([receipt.runId, input.inputSha256])}`, evidenceBundleId: input.evidenceBundleId, configurationId: input.configurationId,
        stories, evidence: input.evidence.filter((entry) => evidenceIds.has(entry.id)) };
      const reviewInput = { ...context, inputSha256: inputDigest(context) };
      let review: Verification | undefined;
      const available = eligible(other) && !!options.providers[other]?.verifier && roleAvailable("review");
      if (!roleAvailable("review")) decide(edition, other, "attempt-budget-exhausted");
      if (available) {
        try { review = valid((await semanticAttempt(reviewInput, edition, "review", other)).result, reviewInput); }
        catch { /* External error text is not audit material. */ }
        if (!eligible(other)) review = undefined;
      }
      for (const original of targets) {
        const checked = review?.assessments.find((entry) => entry.storyId === original.storyId && entry.claimId === original.claimId);
        receipt.reviews.push({ inputSha256: input.inputSha256, storyId: original.storyId, claimId: original.claimId,
          inputClaimSha256: inputDigest(input.stories.find((story) => story.id === original.storyId)!.claims.find((claim) => claim.id === original.claimId)),
          primaryProvider: attempt.provider, reviewProvider: available ? other : null, primaryAssessmentSha256: inputDigest(original), reviewAssessmentSha256: checked ? inputDigest(checked) : null,
          outcome: !available ? "review-unavailable" : !checked ? "invalid-review" : checked.conclusion === "unsafe" || checked.wording === "unsafe" || checked.evidence.some((entry) => entry.relation === "irrelevant") ? "unsafe-review" : inputDigest(assessmentDecision(original)) === inputDigest(assessmentDecision(checked)) ? "agreed" : "disputed" });
      }
      save(); return result;
    },
  };
}
