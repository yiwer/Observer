---
status: accepted
---

# Use the Owner's existing native Codex login for first local validation

On 2026-09-08 the Owner selected the already logged-in local Codex CLI and explicitly removed country/region review as a project prerequisite. Implement a native execution path that lets the CLI use its own existing authentication, without copying credentials, requiring a separately billed API key, or representing a skipped region review as a successful qualification. This supersedes ADR-0002's mandatory region-review and VPS-first prerequisites for the initial V1 validation; future server deployment remains separate work.

Native execution must report its actual process/authentication boundary, not fabricate container IDs, API-broker receipts or container cleanup. Keep bounded runtime, cancellation, restricted model tools, credential-safe child environments and honest unknown usage/cost; do not change global authentication/network settings or bypass a provider's actual rejection. Claude remains Owner-deferred, and source rights, product delivery, recovery and real human evaluation keep their independent evidence requirements.
