---
status: accepted
---

# Start the private brief spine with TypeScript and an atomic SQLite archive

V1-01 uses one Node 24 process with TypeScript and SQLite, storing each immutable Report Record, Report Version and Canonical Markdown together in one atomic insert. This keeps the first private publication seam usable without a database server, an ORM, or coordinating separate Markdown files; changing storage later will require preserving these published identities and bytes. SQLite's `user_version` records forward migrations, and unknown newer storage versions fail closed rather than being silently opened for writing.

## Consequences

The initial migration (0 → 1) creates the archive inside one transaction; primary keys and update/delete rejection triggers protect already published rows. A second publication for the same date fails with `version-already-exists`; scheduler retries, correction versions and migration tooling beyond this initial version belong to later tickets. The database is a single-node durable archive, not a backup or high-availability claim.

Node's built-in SQLite avoids a native npm driver and its platform build steps; its synchronous calls are acceptable for this one-story local spine. The tested Node **24.18.0** ships SQLite **3.53.1**; Node documents `node:sqlite` as release-candidate stability, so future Node upgrades require the smoke checks again ([version-specific documentation](https://nodejs.org/download/release/v24.18.0/docs/api/sqlite.html)). A JSON-file archive was rejected because coordinating immutable metadata and body commits across files would recreate transactional storage concerns.

TypeScript 5.9.3 supplies a separate static check; Node runs test `.ts` files by type stripping, while `tsc` emits `.js` for the production entry with relative import extensions rewritten. The configuration uses `erasableSyntaxOnly` and `verbatimModuleSyntax`; type stripping does not replace typechecking ([Node TypeScript documentation](https://nodejs.org/docs/latest-v24.x/api/typescript.html)). Node's test runner, real temporary SQLite databases and real HTTP child processes exercise the agreed PRD T1 seam; Zod 4.1.12 validates versioned values at entry, Agent return and archive read/write ([Zod parsing contract](https://zod.dev/basics)).

Only automated tests contain a fixed Evidence Bundle and a fake Agent. The production composition has no AgentRunner or publication route, denies programmatic publication, and refuses to serve fixture provenance even if pointed at a test database. Real research publication requires a later, explicit implementation of the evidence/quality gate; merely changing a provider name or environment flag cannot qualify these records.
