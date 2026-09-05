import { createObserver } from "../../src/observer.ts";
import { startPrivateServer } from "../../src/http.ts";
import { clock, ownerToken, request, successfulResult } from "../fixtures.ts";

const databasePath = process.argv[2];
if (!databasePath) throw new Error("A test archive path is required");
const observer = createObserver({
  databasePath, ownerToken, mode: "test-fixture", clock,
  runner: { run: async () => successfulResult() },
});
if (process.argv[3] === "produce") await observer.produce(request);
const server = await startPrivateServer(observer);
process.send?.({ port: server.port });
process.on("message", async (message) => {
  if (message === "stop") {
    await server.close();
    observer.close();
    process.disconnect();
  }
});
