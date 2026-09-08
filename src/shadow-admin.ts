import { setTimeout as pause } from "node:timers/promises";
import { loadShadowConfiguration, openShadowEvaluation, readShadowJson } from "./shadow-evaluation.ts";
import { shadowRules } from "./shadow-contracts.ts";

const [flag, file, command, argument, option, ...extra] = process.argv.slice(2);
if (command === "rules" && flag === "--config" && file && !argument) {
  console.log(JSON.stringify({ status: "draft-requires-human-approval-before-campaign", rules: shadowRules }, null, 2));
} else if (flag !== "--config" || !file || !command || extra.length ||
  !["campaign", "freeze", "start", "fail", "complete", "review", "probe", "form", "status", "export", "maintain", "watch"].includes(command) ||
  (["maintain", "watch"].includes(command) ? !!argument : !argument) || (option !== undefined && !(command === "export" && option === "--material"))) {
  console.error("Usage: shadow --config <shadow.json> rules | campaign|freeze|start|fail|complete|review|probe <input.json> | form <attempt-id> | status <campaign-id> | export <batch-id> [--material] | maintain | watch");
  process.exitCode = 1;
} else {
  let archive: ReturnType<typeof openShadowEvaluation> | undefined;
  try {
    archive = openShadowEvaluation(loadShadowConfiguration(file));
    let result: unknown;
    switch (command) {
      case "campaign": result = archive.createCampaign(readShadowJson(argument!)); break;
      case "freeze": result = archive.freeze(readShadowJson(argument!)); break;
      case "start": result = archive.start(readShadowJson(argument!)); break;
      case "fail": result = archive.fail(readShadowJson(argument!)); break;
      case "complete": result = archive.complete(readShadowJson(argument!)); break;
      case "review": result = archive.review(readShadowJson(argument!)); break;
      case "probe": result = await archive.probe(readShadowJson(argument!)); break;
      case "form": result = archive.form(argument!); break;
      case "status": result = archive.status(argument!); break;
      case "export": result = archive.exportBatch(argument!, option === "--material"); break;
      case "maintain": result = archive.maintain(); break;
      case "watch": {
        const stop = new AbortController(); process.once("SIGINT", () => stop.abort()); process.once("SIGTERM", () => stop.abort());
        while (!stop.signal.aborted) {
          // A failed authority read stays visibly failed and retries; it is never an empty authority.
          try { console.log(JSON.stringify(archive.maintain())); } catch { console.error("shadow-maintenance-failed"); }
          try { await pause(60000, undefined, { signal: stop.signal }); } catch { break; }
        }
        result = { state: "stopped" }; break;
      }
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const code = error instanceof Error && /^shadow-[a-z0-9-]+$/.test(error.message) ? error.message : "shadow-command-failed";
    console.error(code); process.exitCode = 1;
  } finally { archive?.close(); }
}
