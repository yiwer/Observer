---
status: accepted
---

# Separate expiring source material from permanent report records

V1-02 uses a mutable, single-node SQLite collection cache alongside the V1-01 immutable report archive. Each Owner-reviewed Source Policy is versioned and fingerprinted, with independent field grants for collection, storage, model input and distribution. Keeping raw material in the immutable archive would make source TTL and revocation incompatible with the archive's existing update/delete rejection rules.

## Consequences

The collection cache has its own `application_id` and storage version; it is never a migration of the report database. Source removal, approval withdrawal or a newer policy version removes the previous cached material and validators. An edited policy with the same version, a rollback, and unknown database versions fail closed. Record keys and HTTP validators are stored only when explicitly permitted; source content hashes are separate, optional licensed fields.

Collected Evidence Bundle v2 carries policy identities, nullable/optional source fields and explicit gaps. V1-01 Bundle v1 and its 13 tests remain supported, but only in the existing fixture publication composition. The ProduceRequest v1 envelope now accepts either bundle version; downstream code must explicitly understand Bundle v2. This does not qualify any real model or publication pipeline.

Model input and distribution are independent projections of the collected snapshot. The report archive never receives a source `content` field. Permanent original text and permitted explicit quotations require a separate `allowPermanentArchive` grant; finite raw cache retention alone never authorizes a permanent report. Citation limits apply to explicit quotations, not original analysis. Detecting fabricated facts or disguised copying in purported original prose belongs to the future Publication Gate; production publication remains disabled meanwhile.

The normal network implementation uses certificate-checked HTTPS, original hostname/SNI and a pinned, vetted DNS address for every redirect hop. Only the reviewed feed origin is eligible for body reads. Tests may replace external DNS and transport; this is not a production local-network permission switch.
