export interface CodexModelTransport {
  readonly provenance: "model-protocol-fixture" | "openai-api";
  respond(body: Record<string, unknown>, signal: AbortSignal): Promise<{ status: number; body: string }>;
}

// Explicit construction is required. No ambient key, proxy URL, account or
// saved Codex authentication is read. The only endpoint is Responses creation.
export function createOpenAIModelTransport(apiKey: string): CodexModelTransport {
  if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error("invalid-model-credential");
  return { provenance: "openai-api", async respond(body, signal) {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", redirect: "error", signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 2 * 1024 * 1024) throw new Error("model-output-limit");
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
    }
    return { status: response.status, body: Buffer.concat(chunks).toString("utf8") };
  } };
}

// Both native and hosted executable tool calls are rejected before delivery to
// Codex. A message containing source/code text remains inert message data.
export function modelResponseHasNoTools(body: string): boolean {
  try {
    const values: unknown[] = body.trimStart().startsWith("{") ? [JSON.parse(body)] : body.split("\n")
      .filter((line) => line.startsWith("data:") && line.slice(5).trim() !== "[DONE]")
      .map((line) => JSON.parse(line.slice(5)));
    if (!values.length) return false;
    for (const value of values) {
      if (!value || typeof value !== "object") return false;
      const event = value as Record<string, unknown>;
      if (typeof event.type === "string" && /function|tool|shell|mcp|computer|web_search|file_search|apply_patch|image_generation|code_interpreter/.test(event.type)) return false;
      const response = (event.response ?? event) as Record<string, unknown>;
      const items = [...(Array.isArray(response.output) ? response.output : []), ...(event.item ? [event.item] : [])];
      if (items.some((item) => !item || !["message", "reasoning"].includes(item.type))) return false;
    }
    return true;
  } catch { return false; }
}
