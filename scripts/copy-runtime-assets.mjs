import { copyFile } from "node:fs/promises";
await copyFile(new URL("../src/agent-worker.py", import.meta.url), new URL("../dist/agent-worker.py", import.meta.url));
