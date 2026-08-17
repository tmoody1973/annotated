# Annotated 2026 Midterm Campaign PRD

## **The 2026 Receipt**: a national, state, and local public-record campaign

| Field | Definition |
|---|---|
| Objective | Use the 2026 midterm cycle to prove Annotated’s source-first community model: readers inspect public claims, follow the underlying record, add accountable context, and return when that record changes. |
| Campaign boundary | Nonpartisan civic information. The campaign does not endorse candidates/parties, recommend a vote, target readers by political preference, or publish unsupported allegations. |
| General-election milestone | Tuesday, November 3, 2026. State primary, early-voting, registration, absentee, and certification dates vary and must link to verified official state/local election authorities. [1] |
| Product alignment | R1 Evidence-Aware Threads → R2 Stewarded Rooms → R3 Quality-Aware Discovery. |

## 1. Product decision

The midterm campaign should be a **buildable product program**, not editorial content placed on a generic feed. Each campaign item is a **Claim / Receipt / Context** thread. It starts with an attributable public source, distinguishes source text from commentary, welcomes structured context and correction, and lets readers follow the evolving record.

The campaign begins nationally, then creates a small number of staffed state editions and local source packs. This structure connects national debates—AI infrastructure, energy, water, jobs, public spending, creator rights, and AI policy—to the local documents that shape people’s lives: planning packets, utility filings, tax agreements, state bills, hearings, and official statements. Data-center development is an especially suitable opening theme because it connects AI policy with visible local trade-offs. [2] [3]

> **Campaign promise:** *What was promised, what does the record show, and what question remains?*

## 2. Audience and success definition

| Priority audience | Campaign job to be done | First action to optimize |
|---|---|---|
| News-curious professionals and policy-adjacent readers | Understand a consequential claim without relying on fragments or partisan framing. | Follow an issue, thread, source, contributor, or state edition. |
| Reporters, researchers, and policy communicators | Add source-linked context and make expertise discoverable. | Publish an evidence-backed response. |
| AI, energy, infrastructure, and local-government communities | Follow live public decisions and their documentation. | Save/follow a local source pack. |
| Local readers in affected jurisdictions | Inspect a proposal, hearing, rate case, or public claim where they live. | Select a state and open an official/local source. |
| Publishers and original creators | Add attributable source-side context without suppressing criticism. | Verify identity and respond to a linked source. |

The primary success event is **a reader follows a public record**—a campaign thread, source pack, issue, source, contributor, state, or locality. Account creation alone is not activation. The campaign succeeds when users return for a changed source, verified context, correction, hearing update, or weekly receipt.

## 3. Release mapping

| Release | Campaign capability | Outcome |
|---|---|---|
| **R1: Evidence-Aware Threads** | Source-card metadata, Claim / Receipt / Context threads, typed replies, evidence attachment, source-owner response, follow/update, separate reports and rights claims. | Campaign discussion is structured around evidence rather than generic comments. |
| **R2: Stewarded Rooms** | National campaign room, state editions, local source packs, guides, editor/steward roles, weekly prompts, curation, report queues. | Readers can follow a state/local public record and trust that it has standards and ownership. |
| **R3: Quality-Aware Discovery** | National/Your State/Local to You feeds, editor/freshness/following discovery, explanations, feedback, diversity constraints, audit logs. | Timely source-backed material is discoverable without optimizing for partisan outrage or raw engagement. |

# 4. R1 requirements — Evidence-Aware Civic Record Threads

## R1 functional requirements

| ID | Requirement |
|---|---|
| R1-M1 | Every campaign thread shows direct source URL, source type, source date, retrieval date, attribution, source-pack status, and editorial selection note. |
| R1-M2 | New contributions use R1 response intents: Add context, Challenge with a source, Support with a source, Ask a question, Correct a factual point, and verified Publisher/source-owner response. |
| R1-M3 | Campaign threads distinguish source text, editorial note, community response, verified source-owner response, and correction/update state. |
| R1-M4 | Readers can follow a thread, source pack, issue, source, contributor, or state and choose immediate, weekly, or off notifications. |
| R1-M5 | Context/conduct reports and fair-use/rights claims are separate flows with separate routing. |
| R1-M6 | Candidate/officeholder statements show office, jurisdiction, date, original source, and context without any endorsement, partisan scorecard, or voter recommendation. |

## R1 user stories and acceptance criteria

### R1-US1 — Read a claim with its record

**As a reader, I want to see the original source and why it was selected before commentary, so that I can inspect the record myself.**

| Acceptance criteria |
|---|
| The thread displays source metadata, direct original URL, source/retrieval date, and selection note before campaign interpretation. |
| A selection note explains relevance and at least one limitation or unresolved question. |
| Candidate/officeholder threads display office, jurisdiction, action/statement date, and original source; they contain no endorsement or voting recommendation. |
| Material editorial changes display a dated correction/update label and preserve an accessible audit reference. |

### R1-US2 — Add evidence-backed civic context

**As a contributor, I want to add a source, correction, question, or context, so that the public record becomes more complete rather than merely more reactive.**

| Acceptance criteria |
|---|
| Composer shows the approved response intents and promotes evidence attachment for Challenge, Support, and Correct. |
| Unsourced questions may be allowed but are labeled Unsourced and excluded from Primary sources views. |
| A contribution made from a localized page inherits campaign, state, locality, and source-pack associations. |
| Contribution guidance prohibits endorsements, voting advice, personal attacks, doxxing, and unverified allegations. |

### R1-US3 — Follow a record through change

**As a reader, I want to follow a source pack or thread, so that I return when meaningful evidence or public status changes.**

| Acceptance criteria |
|---|
| Readers can follow campaign, thread, source pack, issue, state, locality, source, or contributor after authentication. |
| Notifications are limited to new sources, status changes, corrections, verified source responses, or selected editorial cadence. |
| Every update deep-links to the changed material and identifies what changed. |
| Follow preferences are reviewable and reversible. |

### R1-US4 — Report the right problem

**As a reader or source owner, I want to report misrepresentation, conduct, or rights issues through the correct path, so that campaign integrity is maintained.**

| Acceptance criteria |
|---|
| Report categories include misleading excerpt, missing context, wrong attribution, harassment, personal information, spam, and rights/fair-use. |
| Rights claims route to central claims handling and are never decided by votes or campaign editor preference. |
| High-risk open reports prevent discovery promotion pending review. |
| Reporter identity is not shown to the target. |

# 5. R2 requirements — Stewarded National, State, and Local Spaces

## R2 functional requirements

| ID | Requirement |
|---|---|
| R2-M1 | Launch one national campaign room, **The 2026 Receipt**, with public mission, selection/correction policy, standards, and named editor/back-up reviewer. |
| R2-M2 | Support state editions and optional localities through a manual state selector; do not require precise geolocation. |
| R2-M3 | Use local source packs as bounded case files for a specific decision, claim, project, bill, hearing, or public record. |
| R2-M4 | Support Campaign Editor, State Steward, Backup Reviewer, Verified Source Owner, and Contributor roles with server-enforced permissions. |
| R2-M5 | Pilot three staffed state editions; do not create 50 empty feeds or self-service local groups. |
| R2-M6 | Verify and timestamp official state/local election-authority links before showing election-process information. |

## R2 user stories and acceptance criteria

### R2-US1 — Choose a state edition

**As a reader, I want to choose my state and optionally locality, so that I can see the public record connected to where I live.**

| Acceptance criteria |
|---|
| A manual state selector and optional county/city selector are available; selected preference is editable and does not rely on precise GPS. |
| A staffed state page shows guide, editor/steward, official election-authority link, issue shelves, and featured source packs. |
| State election-process cards display official source URL, verification date, and update timestamp. |
| If a state is not staffed, the reader sees national material plus a source-request/waitlist path—not an empty state feed. |

### R2-US2 — Follow a local source pack

**As a local reader, I want to track one specific decision, so that I return when its public record changes.**

| Acceptance criteria |
|---|
| Every source pack shows jurisdiction, responsible agency/body, question, status, primary sources, retrieval date, and next key date when known. |
| Status values include proposed, under review, hearing scheduled, voted, implemented, contested, archived, and awaiting source. |
| Material updates include agenda/filing, hearing move, vote/result, permit change, correction, or verified source response. |
| Archived packs retain readable status history and source links. |

### R2-US3 — Steward a state edition under shared standards

**As a State Steward, I want scoped editorial and safety tools, so that I can publish timely local records without creating a separate partisan community.**

| Acceptance criteria |
|---|
| State tools support source-pack creation, curation, prompts, report triage, status updates, and correction requests. |
| Features, hides, or de-ranks require reason, actor/time audit, and author notice where applicable. |
| State Stewards cannot decide rights claims, change national policies, or publish unverified election deadlines. |
| Campaign Editors can audit corrections, coverage consistency, source/perspective representation, and escalations across states. |

# 6. R3 requirements — Time-Sensitive, Explainable Discovery

## R3 functional requirements

| ID | Requirement |
|---|---|
| R3-M1 | Campaign discovery exposes National, Your State, Local to You, Editor’s Picks, Fresh Evidence, and Following. |
| R3-M2 | Each ranked item carries a reason label and a link to campaign selection/ranking standards. |
| R3-M3 | Ranking uses source completeness, status timeliness, useful/well-sourced context, correction state, follows, safety, and diversity—not inferred politics or raw engagement. |
| R3-M4 | Users can select Less from this issue, Mute source, Already seen, and Not useful; controls are reversible. |
| R3-M5 | Ranking audit logs preserve feed, item, reason codes, version, eligibility, and experiment data using non-sensitive summaries. |

## R3 user stories and acceptance criteria

### R3-US1 — Move from national to local discovery

**As a reader, I want National, Your State, and Local to You views, so that I can move from broad campaign questions to records relevant to me.**

| Acceptance criteria |
|---|
| Feed modes explain what they prioritize and persist selection in URL/history. |
| Your State uses selected state only; Local to You uses optional locality and has a national/state fallback. |
| Logged-out users can browse public national and staffed state content; personal Following explains sign-in requirements. |
| Users can change/clear state-local preference without losing national campaign access. |

### R3-US2 — Understand why an item appears

**As a reader, I want a concise reason for a ranked civic item, so that I can evaluate relevance and editorial judgment.**

| Acceptance criteria |
|---|
| Reasons include Editor’s Pick, New official filing, Followed source-pack update, Selected state, Several sourced perspectives, or Correction added. |
| Reasons never disclose another user’s location, political preference, activity, or private content. |
| A personalized campaign recommendation without a safe/accurate explanation is not shown. |
| Editorial and ranking standards are accessible from each discovery surface. |

### R3-US3 — Prioritize public-record value over political engagement

**As a reader, I want campaign discovery to reward evidence and timely updates rather than outrage, so that I can find material worth inspecting.**

| Acceptance criteria |
|---|
| Eligibility requires attribution, retrieval date, campaign/source-pack status, and no unresolved severe safety restriction. |
| Ranking may use source completeness, correction status, contextual response quality, recency, follows, and diversity. |
| Ranking must not use inferred party affiliation, candidate preference, issue stance, demographic political profiling, or raw reaction volume as a sole decision signal. |
| Re-ranking limits repeated candidates, parties, authors, source domains, state editions, and one-sided response patterns when eligible candidates permit. |
| Official corrections and status updates receive timely promotion regardless of engagement. |

# 7. Operations, analytics, and rollout

## Source/operations workflow

| Stage | Required action |
|---|---|
| Intake | Log source, jurisdiction, author/agency, issue, and relevance hypothesis. |
| Verification | Confirm direct source, attribution, date, excerpt fidelity, and election-authority status where applicable. |
| Context check | Identify trade-offs, limitation, correction need, and verified response route. |
| Publication | Publish source card with selection note, state/local metadata, and linked Claim / Receipt / Context thread. |
| Update | Add visible timestamp/status/correction when verified material changes. |
| Moderation | Triage reports, escalate rights claims, record rationale, and notify affected contributors where appropriate. |
| Weekly review | Audit coverage, corrections, source quality, state performance, reports, and follow/return metrics. |

## Campaign instrumentation and metrics

| Area | Required events or metrics |
|---|---|
| Acquisition | Campaign edition view, referrer, state selection, source-pack view, partner referral. |
| Activation | Source link opened, campaign/state/local follow created, save, response composer opened. |
| Contribution quality | Response intent, evidence attached, correction added, report submitted, moderation outcome. |
| Retention | 7-day/28-day return after campaign/state/local/source-pack follow; update notification click-through. |
| Trust | Direct-source/selection-note coverage, verified official-election-link rate, correction time, report rate, moderation response time. |
| R3 audit | Ranked impression, feed/reason code, ranking version, eligibility, experiment and feedback action. |

## Time-sensitive release plan

| Window | Release/campaign action |
|---|---|
| Aug. 11–21 | R1 campaign MVP: metadata, selection notes, typed context, report routing, follows; seed 12 high-quality threads; launch national room guide. |
| Aug. 22–Sept. 15 | R2: launch three staffed state pilots with two local source packs each; publish weekly receipts; enable Editor’s Picks/Fresh Evidence with reason labels. |
| Sept. 16–Oct. 6 | Expand candidate/officeholder record threads under uniform rules; add prompts, source requests, state/local follows, and feedback controls. |
| Oct. 7–Nov. 2 | Maintain fast-turn verified source packs and correction discipline; only activate limited R3 quality ranking if explanation, diversity, audit, and safety gates pass. |
| Nov. 3–Jan. 2027 | Distinguish preliminary/certified results; transition campaign to certification, source-pack status, and public-policy follow-through. |

## Launch gates and risks

| Gate/risk | Requirement or mitigation |
|---|---|
| R1 launch | 12 exemplary threads, direct-source and selection-note coverage, correction state, report owner, public reading without sign-in. |
| State pilot | Named editor/back-up, official election link, six source packs, local partner, moderation coverage. |
| R3 ranking | 100% explanation coverage for ranked items, feedback controls, audit logging, no material rise in reports/mutes, diversity checks. |
| Perception of partisan selection | Publish source-selection and correction policy; audit inclusion/coverage; use equal evidence thresholds. |
| Election-process misinformation | Link to verified official state/local authorities; do not state unverified generalized deadlines. |
| Empty/local fragmentation | Use curated pilots and national fallback; do not open uncontrolled state/local spaces. |
| Election-week integrity | On-call review, direct official-result links, preliminary/certified status labels, and no prediction/endorsement content. |

## References

[1]: https://bipartisanpolicy.org/article/the-2026-midterms-key-dates-and-events/ "Bipartisan Policy Center: The 2026 Midterms—Key Dates and Events"
[2]: https://news.gallup.com/poll/709772/americans-oppose-data-centers-area.aspx "Gallup: Americans Oppose AI Data Centers in Their Area"
[3]: https://www.npr.org/2026/04/20/g-s1-117729/data-center-disputes-local-midterms "NPR: Data centers are expensive, unpopular — and could be a tipping point in the midterms"
[4]: https://annotated.sh/ "Annotated — live product"
[5]: https://github.com/tmoody1973/annotated "Annotated repository"
