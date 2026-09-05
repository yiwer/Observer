# Observer Daily Intelligence

Observer exists to give its owner a compact, evidence-backed understanding of materially important daily changes without attempting to reproduce a complete news feed or provide real-time alerts.

## Language

**Owner**:
The single person whose priorities shape the service and who privately receives its output.
_Avoid_: Customer, subscriber, tenant, audience

**Daily Brief**:
A scheduled, evidence-backed synthesis of the day's materially important changes, with no fixed reading-time requirement.
_Avoid_: News feed, news archive, real-time alert

**Edition**:
A subject-focused portion of a Daily Brief with its own editorial scope, such as world affairs, AI, finance, frontier technology, social discourse, or GitHub projects.
_Avoid_: Channel, raw category

**World Affairs Edition**:
An Edition covering materially important geopolitical, public-policy, conflict, disaster, health, or humanitarian developments that do not primarily belong to another Edition.
_Avoid_: General news feed, every international headline

**AI Edition**:
An Edition covering consequential changes in AI research, models, products, developer infrastructure, governance, safety, adoption, and societal impact.
_Avoid_: Every software release, general company financing

**Frontier Technology Edition**:
An Edition covering significant advances in semiconductors and computing, robotics, quantum technology, space, biotechnology, energy and materials, cybersecurity, and emerging infrastructure.
_Avoid_: Routine consumer-product update, AI story duplicated from the AI Edition

**GitHub Project Edition**:
An Edition that surfaces open-source repositories receiving meaningful new attention or activity, while reducing routine repetition of projects already covered.
_Avoid_: GitHub official trending list, repository leaderboard

**Previously Covered Project**:
A repository that appeared in an earlier published GitHub Project Edition and is therefore less eligible for routine repeat coverage unless a material new development occurs.
_Avoid_: Old project, permanently excluded project

**Material Project Development**:
A meaningful change to a Previously Covered Project, such as a major release, security event, direction change, or renewed abnormal attention, that can justify renewed coverage.
_Avoid_: Any commit, routine update

**Observer GitHub Heat**:
Observer's auditable assessment of meaningful new attention or activity around a repository, derived from disclosed GitHub metadata and never represented as GitHub's official ranking.
_Avoid_: GitHub Trending score, official GitHub rank, project quality score

**Repository Snapshot**:
A time-stamped observation of a repository's eligible aggregate metadata used to calculate changes over a declared interval.
_Avoid_: Stargazer event history, exact activity ledger

**Cold-start Heat**:
A separately labeled proxy for repository attention used before Observer has accumulated a complete comparison window.
_Avoid_: 24-hour growth, measured momentum

**Re-promotion Event**:
A previously unreported material release, security development, or exceptional new momentum that makes a Previously Covered Project eligible to bypass ordinary repetition decay once.
_Avoid_: Permanent ranking boost, routine project update

**Priority Story**:
One of the most consequential stories in an Edition, selected for expanded explanation of significance, impact paths, and uncertainty.
_Avoid_: Top story by popularity, breaking item

**Watch Item**:
A selected story that merits awareness but not the expanded treatment of a Priority Story.
_Avoid_: Filler, low-quality story

**Candidate Story**:
A potentially significant development under consideration before it satisfies the publication standard.
_Avoid_: News item, fact

**Event Cluster**:
A group of source reports and candidate stories about the same underlying event, assigned a primary Edition for full coverage.
_Avoid_: Duplicate article, collection of similar headlines

**Impact Note**:
A brief cross-reference explaining an Event Cluster's relevance to another Edition without repeating the primary story or consuming a normal story slot.
_Avoid_: Independent story, duplicate coverage

**Research Agent**:
A provider-neutral delegated investigator that returns Candidate Stories together with supporting evidence; it is not the product or the publication authority.
_Avoid_: Crawler, the system, Codex agent, Claude agent

**Source Registry**:
The reviewed catalog of information sources eligible to contribute Evidence to Observer.
_Avoid_: Open web, search results

**Source Policy**:
The recorded rules governing which fields from a source may be collected, retained, processed by a Research Agent, cited, and delivered.
_Avoid_: Prompt instruction, assumed permission

**Source Proposal**:
A Research Agent's request to review a previously unregistered source; it cannot authorize that source to support publication.
_Avoid_: Approved source, automatic source admission

**Evidence**:
A traceable source record that supports or disputes a claim, including its origin and publication time.
_Avoid_: Context, search result

**Evidence Bundle**:
The cutoff-time snapshot of eligible Evidence supplied to Research Agents for one Daily Brief.
_Avoid_: Agent browsing history, arbitrary web context

**Claim**:
A single assessable statement in a Candidate Story, presented as a fact, a publisher's statement, Editorial Analysis, or a quotation and linked to specific Evidence.
_Avoid_: Story-wide citation, implicitly verified paragraph

**Upstream Origin**:
The original observation or report from which a piece of Evidence derives; multiple republications of that origin do not provide independent corroboration.
_Avoid_: Hosting domain, number of links

**Semantic Assessment**:
An explicit judgment of how particular Evidence supports, contradicts, or is unrelated to a Claim, including whether the wording preserves attribution and uncertainty.
_Avoid_: Schema validation, truth proof, calibrated confidence score

**Publication Gate**:
The evidence and quality standard a Candidate Story must satisfy before it can appear as a stated fact in an Edition.
_Avoid_: Approval, human review

**Unconfirmed Item**:
A Candidate Story whose evidence is insufficient or conflicting and is therefore presented explicitly as unresolved, never as an established fact.
_Avoid_: Rumor reported as fact

**Quarantined Claim**:
A Claim whose structure, source permissions, or safe wording prevents it from being shown, while its identity and rejection reason remain traceable.
_Avoid_: Unconfirmed Item, silently discarded evidence

**Financial Brief**:
An informational Edition about macroeconomic, company, regulatory, and market developments that does not prescribe trades, prices, or expected returns.
_Avoid_: Investment advice, trading signal, stock recommendation

**Social Discourse Brief**:
An Edition describing sampled, platform-visible discourse with its collection boundary disclosed; it never claims to represent a population's opinion.
_Avoid_: Global public opinion, public support rate, social consensus

**Story-linked Discourse**:
Platform-visible arguments and reactions associated with a Candidate Story in another Edition.
_Avoid_: Independent confirmation of the story

**Platform-native Signal**:
An emerging platform-visible topic that satisfies the declared sampling threshold before it has become a verified news event.
_Avoid_: Breaking news, representative public opinion

**Coverage Gap**:
An explicit declaration that an Edition, region, language, platform, or source class lacked sufficient eligible Evidence for normal publication.
_Avoid_: Empty result presented as no news, silently omitted coverage

**Interest Profile**:
The Owner's explicit, editable set of topics, entities, regions, priorities, and exclusions used to personalize story selection.
_Avoid_: Behavioral profile, inferred identity

**Global Baseline**:
The set of materially important developments that remains eligible for publication regardless of the Interest Profile.
_Avoid_: Personalized feed

**Canonical Brief**:
The authoritative, versioned human-readable wording of a Daily Brief from which every delivery representation is derived.
_Avoid_: Email copy, PDF copy

**Report Record**:
The structured record of selected stories, evidence relationships, editorial assessments, source-policy decisions, and generation metadata supporting a Canonical Brief.
_Avoid_: Markdown document, agent transcript

**Report Version**:
An immutable published state of a Daily Brief; a correction creates a later version and marks the earlier one as superseded or retracted.
_Avoid_: Overwritten report, silently edited brief

**Report Archive**:
The long-term, date-addressable history of Report Versions and their correction relationships.
_Avoid_: Latest-report folder, raw source archive

**Material Story Update**:
Newly disclosed facts or substantive developments that justify renewed coverage of an existing Event Cluster.
_Avoid_: Reworded headline, repeated coverage without new evidence

**Late-discovered Story**:
A previously missed disclosure reported later because it retains material relevance, with the delayed discovery explicitly identified.
_Avoid_: Newly occurred event, silently recycled news

**Correction**:
An evidence-backed revision of a published claim that creates a new Report Version and identifies the affected earlier content.
_Avoid_: New development, silent overwrite

**Completion Revision**:
A new Report Version that fills an earlier Coverage Gap using material eligible for the original publication window, within the permitted recovery period.
_Avoid_: Correction of an error, new daily issue

**Rendition**:
A presentation of the Canonical Brief for a particular medium without independently changing its editorial content.
_Avoid_: Separate report, rewritten edition

**Degraded Brief**:
A Daily Brief with explicitly identified omissions caused by unavailable evidence or failed processing, whether published on time or delayed.
_Avoid_: Complete brief, silent failure

**Delayed Brief**:
A Daily Brief published after its delivery deadline and explicitly marked with its actual publication time and delay reason.
_Avoid_: On-time brief, silently late report

**Missed Brief**:
A scheduled Daily Brief that is intentionally recorded as not published after its recovery window has elapsed.
_Avoid_: Empty brief, backdated report

**Editorial Analysis**:
A clearly labeled interpretation, impact path, or possible scenario derived from Evidence but not itself presented as an established fact.
_Avoid_: Fact, prediction stated as certainty

**Today Overview**:
A navigational summary naming the leading item and any Coverage Gap for each Edition without limiting the length of the full Daily Brief.
_Avoid_: Separate short edition, reading-time quota

**On-demand Sync**:
An Owner-initiated retrieval of available Report Versions when the Android client is opened or refreshed, without relying on a push notification.
_Avoid_: Push notification, guaranteed background delivery
