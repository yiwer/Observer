---
status: superseded by ADR-0006 for initial V1 validation
---

# Run first-party agent integrations only from an eligible supported region

2026-09-08 update: [ADR-0006](0006-use-native-codex-for-first-local-validation.md) records the Owner's native Codex choice and cancellation of country/region review as a project gate. The paragraph below is the historical decision, not an instruction to request a country or defer local validation again.

Observer will run its provider-neutral Agent Runners on a personally controlled, single-node VPS in a region officially supported by each enabled provider, with Singapore preferred and Tokyo as a fallback; provider and account eligibility remains a publication prerequisite. A private VPN may secure administration but must not disguise workload location, bypass provider policy, or relay shared credentials, and any ineligible provider stays disabled rather than being reached through a proxy or unsupported-region node.
