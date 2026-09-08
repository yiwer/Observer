/** HTTP-only contract example: usable from a no-GMS client's foreground refresh.
 * Inject secure credential storage and an atomic local saveBatch in a real client. */
export function archiveClient(baseUrl, credential, fetcher = fetch) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))) {
    throw new Error("HTTPS is required outside loopback");
  }
  async function json(path, options = {}) {
    const response = await fetcher(new URL(path, base), {
      ...options, headers: { Authorization: `Bearer ${credential}`, ...options.headers }, redirect: "error",
    });
    if (!response.ok) throw new Error(`Observer HTTP ${response.status}`);
    return response.json();
  }
  return {
    history: (cursor) => json(`/v1/archive?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
    report: (businessDate, version = "latest", edition = null) => json(`/v1/archive/${encodeURIComponent(businessDate)}/${version === "latest" ? "latest" : `versions/${encodeURIComponent(version)}`}${edition ? `?edition=${encodeURIComponent(edition)}` : ""}`),
    async syncOnce(cursor, saveBatch) {
      let page;
      do {
        page = await json(`/v1/sync?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        // Keep tombstones/state events even if there is no readable report.
        // Do not reconstruct Completion text from this revision's record.stories.
        const dates = [...new Set(page.events.map((event) => event.businessDate))];
        const currentViews = await Promise.all(dates.map((date) => json(`/v1/archive/${date}`)));
        // Upsert immutable events by eventId, current views by businessDate, and
        // checkpoint together. A crash before this commit safely repeats the page.
        await saveBatch({ events: page.events, currentViews, cursor: page.nextCursor });
        cursor = page.nextCursor;
      } while (page.hasMore);
      return cursor;
    },
  };
}

export async function pairDevice(baseUrl, pairingId, code, deviceName, fetcher = fetch) {
  // Reuse the transport boundary; pairing sends no pre-existing owner credential.
  archiveClient(baseUrl, "", fetcher);
  const response = await fetcher(new URL("/v1/devices/pair", baseUrl), { method: "POST", redirect: "error",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairingId, code, deviceName }) });
  if (!response.ok) throw new Error(`Observer pairing HTTP ${response.status}`);
  return response.json(); // Store credential securely once; never log this result.
}
