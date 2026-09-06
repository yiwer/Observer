import { z } from "zod";
import { createHash } from "node:crypto";
import { createSourceReader } from "./source-network.ts";
import type { SourcePolicy, SourceReadRequest, SourceResponse } from "./collection.ts";
import { GitHubRepositorySchema, GitHubReasonSchema, githubRules, type GitHubReason } from "./github-contracts.ts";

export const githubDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function githubFailure(error: unknown): GitHubReason {
  const parsed = GitHubReasonSchema.safeParse(error instanceof Error ? error.message : null);
  return parsed.success ? parsed.data : "github-network-failed";
}
const CredentialSchema = z.strictObject({ kind: z.literal("fine-grained-pat"), token: z.string().regex(/^github_pat_[A-Za-z0-9_]{10,255}$/),
  expiresAtUtc: z.iso.datetime({ precision: 3, offset: false }), repositoryAccess: z.literal("public-only"), permissions: z.literal("metadata-read-only") });
export interface GitHubAccess { source: SourcePolicy; credential: () => unknown; clock: () => string; authorize: () => GitHubReason | null; signal?: AbortSignal; deadline?: number; }
export function createGitHubAdapter(options: { read?: (url: string, request: SourceReadRequest) => Promise<SourceResponse> } = {}) {
  const read = options.read ?? createSourceReader();
  let cooldownUntil = 0;
  const headerLimit = (status: number, headers: Readonly<Record<string, string>>) => status === 429 || status === 403 && (headers["x-ratelimit-remaining"] === "0" || !!headers["retry-after"]);
  async function get(url: URL, access: GitHubAccess) {
    const failure = access.authorize(); if (failure) throw new Error(failure);
    if (Date.parse(access.clock()) < cooldownUntil) throw new Error("github-rate-limited");
    const secret = CredentialSchema.safeParse(access.credential());
    if (!secret.success) throw new Error("github-credential-unavailable");
    if (secret.data.expiresAtUtc <= access.clock()) throw new Error("github-credential-expired");
    const timeoutMs = Math.min(access.source.limits.timeoutMs, (access.deadline ?? Infinity) - Date.now());
    if (timeoutMs <= 0) throw new Error("github-timeout");
    const search = url.pathname === "/search/repositories";
    const validateUrl = (target: URL) => {
      const failure = access.authorize(); if (failure) throw new Error(failure);
      if (secret.data.expiresAtUtc <= access.clock()) throw new Error("github-credential-expired");
      return target.origin === "https://api.github.com" && !target.username && !target.password && !target.hash &&
        (search ? target.href === url.href : /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(target.pathname) && !target.search);
    };
    const controller = new AbortController();
    const abort = () => controller.abort();
    access.signal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (access.signal?.aborted) throw new Error("github-cancelled");
      const response = await Promise.race([read(url.href, { source: { ...access.source, limits: { ...access.source.limits, maxRedirects: search ? 0 : Math.min(access.source.limits.maxRedirects, githubRules.maxRedirects) } },
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${secret.data.token}`, "x-github-api-version": githubRules.apiVersion }, signal: controller.signal, validateUrl,
        readErrorBody: (status, headers) => status === 403 && !headerLimit(status, headers) }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("github-timeout")); }, timeoutMs); })]);
      if (access.signal?.aborted) throw new Error("github-cancelled");
      if (access.authorize()) throw new Error(access.authorize()!);
      if (secret.data.expiresAtUtc <= access.clock()) throw new Error("github-credential-expired");
      if (response.finalUrl && !validateUrl(new URL(response.finalUrl))) throw new Error("github-unsafe-route");
      let secondaryLimit = false;
      if (response.status === 403 && !headerLimit(response.status, response.headers)) {
        if (Buffer.byteLength(response.body) > access.source.limits.maxResponseBytes) throw new Error("github-response-too-large");
        try {
          const error = z.object({ message: z.string().max(2000) }).parse(JSON.parse(response.body));
          secondaryLimit = /\bexceeded (?:a |the )?secondary rate limit\b/i.test(error.message);
        } catch { /* An unrecognized error body grants nothing and stays access-unavailable. */ }
      }
      if (headerLimit(response.status, response.headers) || secondaryLimit) {
        const retry = response.headers["retry-after"];
        const retryAt = retry && /^\d+$/.test(retry) ? Date.parse(access.clock()) + Number(retry) * 1000 : Date.parse(retry ?? "");
        const resetAt = Number(response.headers["x-ratelimit-reset"]) * 1000;
        const boundedUtc = (value: number) => Number.isFinite(value) && value >= 0 && value <= Date.parse("9999-12-31T23:59:59.999Z") ? value : 0;
        cooldownUntil = Math.max(Date.parse(access.clock()) + 60000, boundedUtc(retryAt), boundedUtc(resetAt));
        throw new Error("github-rate-limited");
      }
      if ([401, 403, 404, 410].includes(response.status)) throw new Error("github-access-unavailable");
      if (response.status !== 200) throw new Error("github-network-failed");
      if (Buffer.byteLength(response.body) > access.source.limits.maxResponseBytes) throw new Error("github-response-too-large");
      return { response, observedAtUtc: access.clock() };
    } finally { clearTimeout(timer); access.signal?.removeEventListener("abort", abort); }
  }
  return {
    resumeAtUtc: () => cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
    async search(query: string, page: number, access: GitHubAccess) {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", `${query} is:public fork:false`); url.searchParams.set("sort", "updated"); url.searchParams.set("order", "desc");
      const pageSize = Math.min(githubRules.pageSize, access.source.limits.maxItems);
      url.searchParams.set("per_page", String(pageSize)); url.searchParams.set("page", String(page));
      const { response } = await get(url, access);
      try {
        const parsed = z.object({ total_count: z.number().int().nonnegative(), incomplete_results: z.boolean(), items: z.array(z.unknown()).max(pageSize) }).parse(JSON.parse(response.body));
        const links = [...(response.headers.link ?? "").matchAll(/<([^>]+)>\s*;\s*rel="next"/g)];
        let nextPage: number | null = null;
        let paginationValid = links.length <= 1;
        if (links.length === 1) {
          const next = new URL(links[0]![1]!);
          const expected = new URL(url); expected.searchParams.set("page", String(page + 1));
          const canonical = (value: URL) => { value.searchParams.sort(); return value.href; };
          paginationValid = canonical(next) === canonical(expected);
          if (paginationValid) nextPage = page + 1;
        }
        return { ...parsed, nextPage, paginationValid };
      } catch { throw new Error("github-invalid-response"); }
    },
    async repository(fullName: string, access: GitHubAccess) {
      const { response, observedAtUtc } = await get(new URL(`https://api.github.com/repos/${fullName}`), access);
      try { return { repository: GitHubRepositorySchema.parse(JSON.parse(response.body)), observedAtUtc, responseSha256: createHash("sha256").update(response.body).digest("hex") }; }
      catch { throw new Error("github-invalid-response"); }
    },
  };
}
export type GitHubAdapter = ReturnType<typeof createGitHubAdapter>;
