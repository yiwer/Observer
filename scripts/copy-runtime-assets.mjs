import { copyFile } from "node:fs/promises";
await copyFile(new URL("../src/codex-worker.py", import.meta.url), new URL("../dist/codex-worker.py", import.meta.url));
