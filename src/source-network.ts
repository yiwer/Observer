import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import type { ClientRequest, IncomingMessage } from "node:http";
import ipaddr from "ipaddr.js";
import type { SourceReadRequest, SourceResponse } from "./collection.ts";

export class SourceReadError extends Error {}
export interface SourceNetworkIO {
  resolve(hostname: string): Promise<string[]>;
  request(url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void): ClientRequest;
}
const network: SourceNetworkIO = {
  resolve: async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address),
  request: (url, options, callback) => httpsRequest(url, options, callback),
};

// This is an external-I/O injection seam, not a runtime policy switch. Production uses
// system DNS plus certificate-checked HTTPS; no proxy or local-network opt-out is read.
export function createSourceReader(io: SourceNetworkIO = network) {
  return async (input: string, request: SourceReadRequest): Promise<SourceResponse> => {
    let url = new URL(input);
    const origin = new URL(request.source.feedUrl).origin;
    for (let hop = 0; ; hop++) {
      request.signal.throwIfAborted();
      if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || isIP(url.hostname.replace(/^\[|\]$/g, "")) || !url.hostname.includes(".")) throw new SourceReadError("target-forbidden");
      if (url.origin !== origin) throw new SourceReadError("origin-forbidden");
      const addresses = await io.resolve(url.hostname);
      request.signal.throwIfAborted();
      if (!addresses.length || addresses.some((address) => !ipaddr.isValid(address) || ipaddr.process(address).range() !== "unicast")) throw new SourceReadError("target-forbidden");
      const address = addresses[0]!;
      const family = isIP(address);
      const response = await new Promise<SourceResponse>((resolve, reject) => {
        const outbound = io.request(url, {
          agent: false, family, signal: request.signal,
          servername: url.hostname, maxHeaderSize: 16384,
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [{ address, family }]); else callback(null, address, family);
          },
          headers: { "user-agent": "Observer/0.1 source-collection", accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, text/html, text/plain", "accept-encoding": "identity", ...request.headers },
        }, (incoming) => {
          const headers: Record<string, string> = {};
          for (const name of ["location", "retry-after", "etag", "last-modified", "content-type"]) {
            const value = incoming.headers[name]; if (typeof value === "string") headers[name] = value;
          }
          const status = incoming.statusCode ?? 0;
          if (status !== 200) { incoming.destroy(); resolve({ status, body: "", headers }); return; }
          const encoding = incoming.headers["content-encoding"];
          if (encoding && encoding !== "identity") { incoming.destroy(); reject(new SourceReadError("encoding-forbidden")); return; }
          if (Number(incoming.headers["content-length"]) > request.source.limits.maxResponseBytes) { incoming.destroy(); reject(new SourceReadError("response-too-large")); return; }
          let size = 0;
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > request.source.limits.maxResponseBytes) { incoming.destroy(); reject(new SourceReadError("response-too-large")); }
            else chunks.push(chunk);
          });
          incoming.on("end", () => {
            try { resolve({ status, headers, body: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)) }); }
            catch { reject(new SourceReadError("encoding-forbidden")); }
          });
          incoming.on("error", () => reject(new SourceReadError("source-failed")));
        });
        outbound.on("error", () => reject(new SourceReadError(request.signal.aborted ? "timeout" : "source-failed")));
        outbound.end();
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      if (hop >= request.source.limits.maxRedirects || !response.headers.location) throw new SourceReadError("redirect-limit");
      try { url = new URL(response.headers.location, url); }
      catch { throw new SourceReadError("target-forbidden"); }
    }
  };
}
