# Annotated Product Requirements Document

## R1: Evidence-Aware Threads; R2: Stewarded Topic Rooms; R3: Quality-Aware Discovery

| Document field | Value |
|---|---|
| Product | Annotated |
| Status | Final product requirements document |
| Scope | Three sequential releases: R1, R2, and R3 |
| Primary surfaces | Public web clip pages and feeds; authenticated web composer; browser sidebar entry point; room management surfaces |
| Review basis | Live product and public implementation context [1] [2], plus documented Reddit community, moderation, discovery, and contribution-quality patterns [3]–[7] |

## 1. Product context and decision

Annotated’s defensible unit of value is not a generic post. It is an **evidence-backed public argument**: a source excerpt, the contributor’s interpretation, a durable source link, and a discussion that can add context or challenge the framing. The product already supports source-linked clips across articles, podcasts, and YouTube; text or recorded-audio commentary; public landing pages; following; threads; and fair-use claims. [1] [2]

This PRD operationalizes the next product decision: build the discussion and discovery system around **illumination rather than popularity**. R1 makes the purpose of every reply legible. R2 turns selected topics into intentional, stewarded spaces. R3 discovers and ranks high-value material using transparent, bounded signals and user controls. The releases deliberately avoid a generic karma system, automated truth adjudication, self-service community proliferation, and opaque personalization.

> **Product promise:** Every take is attached to a receipt. Every receipt can receive context, challenge, and accountable response.

## 2. Problem statement

A reader today can see a clip, source attribution, notes/comments, voting, and a fair-use claim action. However, they must infer what a response is intended to do, how to find the strongest contextual material, how a publisher reply differs from a normal comment, and what a vote means. A topic is currently a useful filter but not necessarily a return-worthy community. As the product grows, generic social signals would tend to reward attention and agreement rather than accuracy, sourcing, or explanatory value.

The product must therefore solve four related problems:

| Problem | Consequence if unresolved | Product response |
|---|---|---|
| Unstructured replies mix sourced corrections with casual reactions. | Readers cannot easily assess the argument or find the best context. | R1 introduces typed response intent, evidence attachments, thread filters, and an evidence map. |
| Rights disputes and contextual disagreement can be confused. | Users may treat fair-use claims as a debate mechanism. | R1 separates rights claims from contextual/conduct reporting. |
| Broad topics lack a purpose, standards, and active identity. | Topics remain filters rather than places people follow and revisit. | R2 launches a limited number of stewarded rooms. |
| Chronological/social ranking does not optimize for reader learning. | Discovery rewards noise, early reactions, and repetition. | R3 supplies explainable quality-aware feeds, feedback, and diversity controls. |

## 3. Objectives, non-goals, and success principles

### Objectives

The releases will make high-value context obvious, lower the friction of adding sourced follow-up material, give credible source owners a visible but non-vetoing response mechanism, create repeatable community loops, and deliver discovery that users can understand and control.

### Non-goals

These releases will not build automated fact checking, a platform-wide reputation score, open room creation, a credential marketplace, an algorithm that determines which viewpoint is true, or a complete legal adjudication system. Existing fair-use claim handling remains the authoritative rights workflow.

### Cross-release product principles

| Principle | Requirement |
|---|---|
| Source integrity | Every clip and evidence attachment retains a direct original-source URL and attributable metadata when available. |
| Argument over identity | Feedback and ranking prioritize the contribution’s usefulness and sourcing, not the author’s popularity. |
| Standing, not veto | Verified publishers/creators can add context and respond; they do not gain the power to suppress fair criticism because they disagree. |
| Explainability | Any non-chronological recommendation has at least one concise, plain-language reason. |
| Proportionality | Quality and safety tools use limited, documented signals. No private-message data, off-platform tracking, or sensitive inference is used. |
| Public reading | Visitors can read clips, rooms, thread responses, and public guides without signing in. Authentication is required only to change state. |
| Accessibility | All new interactions are keyboard-operable, screen-reader named, and never rely on color alone. |

## 4. Personas and release benefits

| Persona | Job to be done | Benefit by release |
|---|---|---|
| Reader | Understand whether an excerpt is well framed and what context matters. | R1 clarifies threads; R2 provides trusted rooms; R3 speeds discovery. |
| Contributor | Add a source-backed interpretation or correction. | R1 gives contribution an explicit purpose and evidence path. |
| Publisher/creator | Correct missing context and participate without silencing criticism. | R1 labels verified replies; R2 creates durable room participation. |
| Room steward/editor | Set standards and maintain a useful discourse space. | R2 provides guides, prompts, curation, and scoped moderation. |
| Returning follower | See relevant new material with minimal effort. | R3 supplies Following and explainable discovery modes. |
| Product/safety operator | Keep discourse healthy and diagnose ranking or moderation regressions. | All releases create auditable actions, records, and controlled rollout paths. |

## 5. Release overview

| Release | Outcome | Core deliverables | Explicit boundary |
|---|---|---|---|
| **R1** | A clip page reads as an evidence-aware argument rather than a generic comment thread. | Response intents, source attachment, thread filters/map, calibrated reactions, publisher response, separate reporting. | No rooms, personalized ranking, or global reputation score. |
| **R2** | Selected topics become intentional communities with standards and recurring activity. | Rooms, guides, roles, follows, prompts, curation, scoped report queue. | No self-service room creation or unlimited fragmentation. |
| **R3** | Discovery promotes useful, relevant, diverse source-linked conversations. | Intent-based feeds, explainable ranking, feedback/mutes, diversity re-ranking, audit logging. | No opaque personalization or truth scoring. |

# 6. R1 — Evidence-Aware Threads

## 6.1 R1 objective

R1 makes the relationship between evidence, original interpretation, counter-context, and publisher response easy to understand. A reader should be able to answer: **What was said? What does the annotator think? What is the strongest additional context? Is there a credible challenge? Has the source owner responded?**

## 6.2 R1 requirements

| ID | Requirement | Priority |
|---|---|---|
| R1-F1 | Provide six reply intents: **Add context**, **Challenge with a source**, **Support with a source**, **Ask a question**, **Correct a factual point**, and **Publisher response**. | Must |
| R1-F2 | Require an intent for every new signed-in response; default may be Add context but must remain visible and selectable. | Must |
| R1-F3 | Let contributors attach an external URL, an existing Annotated clip, or an optional quoted excerpt. | Must |
| R1-F4 | Render response intent, evidence status, contributor role, source attribution, and edited state in the thread. | Must |
| R1-F5 | Provide contextual thread filters: All, Best context, Counterpoints, Primary sources, Publisher responses, and Questions where qualifying content exists. | Should |
| R1-F6 | Render an evidence map/summary showing the original source, original take, and high-value response branches. | Should |
| R1-F7 | Keep File a Claim for fair-use/rights matters only; add a separate contextual/conduct report path. | Must |
| R1-F8 | Replace generic reply feedback with Useful, Well-sourced, Needs context, and Appreciate reactions. | Must |
| R1-F9 | Hide aggregate numeric reaction totals until configurable activity thresholds are met. | Should |
| R1-F10 | Gate Publisher response on verified ownership of the linked source domain, channel, or creator identity. | Must |

## 6.3 R1 user stories and acceptance criteria

### R1-US1 — Read the argument at a glance

**As a reader, I want to see the originating excerpt, the annotator’s interpretation, and the strongest follow-up context without scanning a generic reply stream, so that I can understand the argument quickly.**

| Acceptance criteria |
|---|
| A public clip page displays the source title, creator/publication, original URL, selected excerpt or playable media segment, and original take before thread responses. |
| If qualifying responses exist, the default view displays up to three ranked response summaries beneath the take, each with a human-readable intent label. |
| If no substantive responses exist, the page displays an explanatory empty state and a prompt such as “Add context” or “Challenge this with a source”; it does not emphasize a zero popularity count. |
| A logged-out reader can open response cards, filters, and evidence links without authentication. Sign-in is required only when the reader follows, reacts, reports, or contributes. |

### R1-US2 — Choose the purpose of a response

**As a contributor, I want to state what my reply is doing, so that readers can distinguish context, challenge, support, questions, and corrections.**

| Acceptance criteria |
|---|
| The authenticated composer displays every allowed intent with a short explanation; Add context is preselected. |
| Selecting Challenge with a source, Support with a source, or Correct a factual point promotes the evidence attachment field and changes its helper copy appropriately. |
| Submission is blocked if no intent is recorded; the error is visible, keyboard accessible, and does not discard the draft. |
| Once published, the response intent is visible as text, not only an icon or color. |
| A response’s intent may be edited only within the configured edit window; later changes retain an audit record and show an edited state. |

### R1-US3 — Attach evidence with low friction

**As a contributor, I want to attach a source or another Annotated clip, so that I can substantiate my interpretation without rebuilding an entire post.**

| Acceptance criteria |
|---|
| The composer permits the contributor to paste a URL, select an internal annotation, include an optional excerpt, or proceed without attached evidence. |
| For a valid external URL, successful extraction displays title, domain, creator/publication when available, and a remove action before publishing. |
| If extraction fails, the contributor may retain the URL after receiving a clear warning that a preview could not be generated. |
| Selecting an internal annotation creates a durable internal link and preserves the linked annotation’s source attribution. |
| An unsourced challenge/support/correction is publishable but is visibly marked **Unsourced** and is excluded from Primary sources filtering. |

### R1-US4 — Find competing context

**As a reader, I want to filter a thread by the kind of material I need, so that I can locate counterpoints, questions, and source-owner context efficiently.**

| Acceptance criteria |
|---|
| A filter is displayed only when at least one visible response qualifies for it. |
| Counterpoints presents Challenge and Correct responses first, followed by their nested replies. |
| Primary sources includes only evidence with an eligible official/original source classification; an arbitrary URL never qualifies by itself. |
| Filter state is represented in the URL and browser history and is announced to assistive technology. |
| Moderation removals or empty results produce a clear explanatory empty state instead of a blank thread. |

### R1-US5 — React in a way that improves the thread

**As a reader, I want to indicate whether a response is useful, well-sourced, needs more context, or is appreciated, so that future readers find better material.**

| Acceptance criteria |
|---|
| An authenticated reader can set one active reaction per response: Useful, Well-sourced, Needs context, or Appreciate; they can change or remove it later. |
| A logged-out reaction attempt starts authentication and returns the user to the same clip/thread state afterward. |
| Below the configured threshold, reaction categories remain available but numeric aggregate totals are not displayed. |
| Contributors can see category aggregates for their content but cannot see identities of individual reactors. |
| The platform rate-limits abnormal reaction patterns and creates an audit event available to authorized reviewers. |

### R1-US6 — See a publisher response without creating a veto

**As a reader, I want to identify a direct response from the original publisher or creator, so that I can weigh their context without assuming it settles the argument.**

| Acceptance criteria |
|---|
| Publisher response is selectable only by an account verified for the relevant source ownership record. |
| Verified responses display the verified identity, connection to the source, and Publisher response label. |
| A publisher response may occupy a single prominent contextual position but cannot hide, delete, or automatically outrank all non-publisher counterpoints. |
| Unverified users cannot impersonate this response type and are directed to the verification workflow. |
| Publisher responses are subject to the same standards, report flow, editing history, and enforcement rules as any other response. |

### R1-US7 — Route claims and context problems correctly

**As a reader or source owner, I want distinct ways to report a rights issue and a discussion problem, so that the platform sends the issue to the right workflow.**

| Acceptance criteria |
|---|
| The overflow menu presents **Report context or conduct** and **File a Claim** as distinct actions with plain-language descriptions. |
| Context/conduct reporting supports Misleading excerpt, Missing context, Wrong attribution, Harassment, and Spam. |
| File a Claim routes only fair-use/copyright-style disputes to the existing claims system; it does not ask a claimant to frame factual disagreement as a rights issue. |
| Every submitted report receives a reference ID and includes target, type, reporter, optional notes, timestamp, and resolution state in the authorized review queue. |
| The target never receives the reporter’s identity through the ordinary product interface. |

## 6.4 R1 interface and data contract

| Area | Minimum product/technical behavior |
|---|---|
| Response object | Stores `annotationId`, optional `parentResponseId`, `authorId`, `intent`, body/audio reference, status, timestamps, and edit metadata. Existing comments may be technically migrated to `add_context` with a `legacy` marker, but must not be retrospectively presented as sourced. |
| Evidence object | Stores response reference, kind (external URL/internal annotation/excerpt), URL or annotation ID, metadata extraction state, optional excerpt, and source classification. |
| Thread query | Returns source card, original take, intent counts, ranked summaries, active filters, viewer state, and stable pagination. Filtering occurs server-side. |
| Reactions | Uses idempotent set/change/remove operations keyed by response and authenticated viewer. Individual reactor identities are never returned to ordinary clients. |
| Publisher verification | Links a verified account to a claimable domain/channel/creator identity and retains verification method, status, and timestamp. |
| Reports | Uses a typed contextual/conduct report taxonomy distinct from the existing rights claim record and requires auditable resolution fields. |

# 7. R2 — Stewarded Topic Rooms

## 7.1 R2 objective

R2 creates a limited number of recognizable, high-signal destinations. A room is not merely a tag page. It is a scoped topic space with a mission, standards, named stewardship, editorial examples, a follow relationship, and a recurring reason to return. This applies the durable part of Reddit’s community model—clear purpose, expectations, active moderation, and useful identity—without inviting uncontrolled fragmentation. [3] [4] [7]

## 7.2 R2 requirements

| ID | Requirement | Priority |
|---|---|---|
| R2-F1 | Add a room entity linked to one primary topic with name, mission, guide, visual identity, discovery status, and lifecycle status. | Must |
| R2-F2 | Publish a room guide with purpose, standards, good examples, resource links, and optional contributor role choices. | Must |
| R2-F3 | Allow authenticated users to follow/unfollow rooms and choose notification level. | Must |
| R2-F4 | Support room-scoped roles: Owner, Steward, Editor, Verified Publisher, and Member. | Must |
| R2-F5 | Allow Stewards to publish recurring prompts and curate starter/featured collections. | Must |
| R2-F6 | Add a room-level report queue and role-authorized moderation tools that respect central rights claim routing. | Must |
| R2-F7 | Do not enable general self-service room creation in R2. | Must |

## 7.3 R2 user stories and acceptance criteria

### R2-US1 — Decide whether a room is relevant

**As a reader, I want a clear room mission, guide, and examples, so that I can decide whether to follow or contribute before I invest time.**

| Acceptance criteria |
|---|
| A public room page displays name, one-sentence mission, full guide, steward/owner identity, current prompt when active, and room status. |
| The guide is readable without sign-in and includes what belongs, standards, examples, and available resources. |
| Official/partnered or unofficial status is explicitly labeled where applicable; no room can imply a relationship that has not been verified. |
| Following a room confirms the subscription and offers notification choices without requiring a choice. |

### R2-US2 — Contribute according to room standards

**As a contributor, I want relevant guidance while I post into a room, so that my contribution fits the room’s purpose.**

| Acceptance criteria |
|---|
| A composer opened from a room displays room identity, one concise relevant rule, and a link to the full guide. |
| A room-specific required tag/source rule is checked before submit; errors preserve all draft content. |
| Successful posts display their room association alongside global topics. |
| Selecting a room from a general composer validates eligibility before association is created. |

### R2-US3 — Follow and revisit a room

**As a returning reader, I want to follow a room and choose how often I hear from it, so that I can stay informed without unwanted interruptions.**

| Acceptance criteria |
|---|
| Following creates a room membership/follow record and makes the room eligible for R3 Following and personalization signals. |
| Notification choices are Off, Highlights, Weekly prompt, and All activity. |
| Highlights respects the configured digest cap and is limited to qualifying editorial or discussion events. |
| Unfollowing removes the room from Following discovery after refresh but never removes public reading access. |

### R2-US4 — Steward a room responsibly

**As a room steward, I want scoped editorial and safety tools, so that I can maintain quality without altering platform-wide policy.**

| Acceptance criteria |
|---|
| Only Owner/Steward roles can manage guide content, resources, prompts, room curation, room reports, and permitted room actions. |
| Featured content is labeled **Featured by [Room]** and does not receive artificial reaction-count inflation. |
| A removal, hide, or de-rank action requires a reason, logs actor/time/reason, and notifies the author with a feedback or appeal path. |
| Unauthorized attempts to access room tools reveal neither moderation records nor private room data. |
| Platform administrators can review and revoke a Steward role when actions show conflict, abuse, or persistent reversal. |

### R2-US5 — Participate through a recurring prompt

**As a room member, I want a recurring question or prompt, so that I have a clear reason to contribute and revisit the room.**

| Acceptance criteria |
|---|
| An active prompt displays title, brief, expiration, and a contextual action at the top of the room. |
| Contributions started from the prompt are associated with both the room and prompt. |
| Expired prompts remain readable with archived contributions but reject new contributions unless extended by an authorized Steward. |
| If no prompt is active, general members do not see an empty prompt card; only authorized Stewards see a creation entry point. |

### R2-US6 — Resolve reports consistently

**As a Steward, I want a dedicated room report queue, so that I can act quickly and consistently on context and conduct problems.**

| Acceptance criteria |
|---|
| Reports on room-associated material appear in the room queue and remain visible to authorized platform reviewers. |
| Resolutions record type, rationale, actor, timestamp, and linkage to the underlying report. |
| Rights/fair-use claims are visibly routed to central claims handling; a room steward cannot unilaterally close or decide them. |
| Moderator action history is available to platform administrators for auditing and escalation. |

## 7.4 R2 data and permission model

| Entity | Essential fields |
|---|---|
| `room` | Slug, name, primary topic, mission, guide, discovery status (`public`, `unlisted`, `paused`), lifecycle (`draft`, `public`, `paused`, `archived`), timestamps. |
| `roomMembership` | Room, user, role, following status, notification level, timestamps. |
| `roomPrompt` | Room, title, brief, start/end time, status, creator. |
| `roomCuration` | Room, target clip/thread, label, optional reason, curator, timestamp. |
| `contentReport` extension | Room association, assignment, resolution, escalation state. |

# 8. R3 — Quality-Aware Discovery

## 8.1 R3 objective

R3 gives readers feeds whose purpose is comprehensible and whose ranking behavior is explainable. It uses source completeness, contextual discussion, relevance, safety, and diversity—not raw popularity—to decide what merits attention. Reddit’s documented approach illustrates the value of differentiated sort modes, recommendation reasons, negative feedback, and diversity controls; Annotated must tailor those mechanisms to source-backed arguments. [5] [6]

## 8.2 R3 requirements

| ID | Requirement | Priority |
|---|---|---|
| R3-F1 | Offer **Editor’s Picks**, **Most Illuminating**, **Most Debated**, **Fresh Evidence**, **Following**, and existing chronological Latest. | Must |
| R3-F2 | Provide a concise explanation for every non-chronological recommendation. | Must |
| R3-F3 | Use a bounded quality model based on source, thread, contribution, recency, relationship, safety, and diversity signals. | Must |
| R3-F4 | Provide feedback controls: Not useful, Less from this room, Mute source, and Already seen. | Must |
| R3-F5 | Apply configurable diversity constraints across author, source domain, room, and response perspective. | Should |
| R3-F6 | Provide Following-only mode, muted sources/rooms, reviewable preferences, and personalization opt-out. | Must |
| R3-F7 | Log ranking version, reason codes, and non-sensitive feature contributions for audit and experiment evaluation. | Must |

## 8.3 R3 user stories and acceptance criteria

### R3-US1 — Choose a discovery mode that matches intent

**As a reader, I want feeds with clear jobs, so that I can choose quality, debate, recency, or activity from people and rooms I follow.**

| Acceptance criteria |
|---|
| Each feed exposes a one-sentence explanation of what it prioritizes. |
| Selecting a feed updates URL and browser history and preserves its state on reload. |
| If Following has no follows, it displays onboarding to follow people, rooms, or sources; it does not silently substitute a personalized feed. |
| Logged-out visitors can browse public editorial and freshness feeds; any feed requiring personal relationship signals explains sign-in requirements clearly. |

### R3-US2 — Understand why an item appears

**As a reader, I want a plain-language reason for a ranked item, so that I can decide whether it is relevant and evaluate the system’s judgment.**

| Acceptance criteria |
|---|
| A non-chronological card exposes one or more reasons such as “Editor’s Pick,” “Because you follow this room,” “Publisher context added,” or “Several sourced perspectives.” |
| Editorially selected items state that selection explicitly and may identify the relevant room/editor. |
| If a personalized reason cannot be safely generated, the item cannot appear through personalized ranking. |
| Reasons never expose another individual’s private behavior, private content, or sensitive personal inference. |

### R3-US3 — Control unwanted recommendations

**As a reader, I want to reduce or mute material I do not find useful, so that discovery improves without forcing me to leave the product.**

| Acceptance criteria |
|---|
| Not useful, Less from this room, Mute source, and Already seen update the current feed promptly and persist preference state. |
| Less from this room reduces recommendations but does not permanently hide it; Mute room is a separate, reversible setting. |
| Mute source excludes new material from personalized and Following recommendations but does not block direct-link access or public search unless policy requires removal. |
| Preference settings allow users to inspect, reverse, and clear all negative controls. |

### R3-US4 — Surface illuminating material fairly

**As a reader, I want Most Illuminating to elevate context and clarity rather than the loudest reaction, so that I can learn efficiently.**

| Acceptance criteria |
|---|
| Ranking incorporates source completeness, substantive response signals, Useful/Well-sourced reactions, contextual diversity, reader relationship relevance, recency, and safety state. |
| High reaction volume alone cannot promote an item with repeated Needs context feedback or unresolved serious moderation risk. |
| Verified status may contribute identity context but cannot independently guarantee promotion. |
| Similar candidates use recency/relevance as tie breakers while diversity constraints limit repetition. |

### R3-US5 — Discover productive disagreement, not conflict

**As a reader, I want Most Debated to surface serious competing perspectives rather than hostility or simple reply volume.**

| Acceptance criteria |
|---|
| Eligibility requires at least two substantive branches with different response intents or evidence positions; raw reply count is insufficient. |
| Threads dominated by harassment reports, repetitive unsourced replies, or unresolved safety risk are ineligible or substantially de-ranked. |
| Eligible cards use neutral language such as “Multiple sourced perspectives,” not sensational or adversarial copy. |
| A publisher reply can contribute to eligibility but cannot be the sole opposing perspective. |

### R3-US6 — Avoid repetitive feeds

**As a reader, I want discovery to show multiple authors, domains, rooms, and perspectives, so that the feed remains useful and does not become monotonous.**

| Acceptance criteria |
|---|
| With at least ten eligible candidates, the feed enforces configurable maximum consecutive items from a single author, source domain, or room. |
| If eligible items lack diversity, the feed shows fewer results or discloses concentration rather than inventing poor candidates. |
| Following can honor intentionally narrow follows, while Editor’s Picks and Most Illuminating retain broader diversity safeguards. |
| Diversity re-ranking never injects content that failed safety or baseline quality eligibility. |

### R3-US7 — Operate ranking responsibly

**As a product operator, I want to inspect ranking decisions and safely test changes, so that we can correct regressions and answer user concerns.**

| Acceptance criteria |
|---|
| A ranked impression records feed type, ranking version, item, candidate position, reason code, eligibility state, experiment assignment, and non-sensitive feature summaries. |
| Authorized operators can inspect high-level drivers without seeing individual reaction identities or private user activity. |
| Each ranking version supports staged rollout, experiment assignment, and rollback. |
| If ranking is unavailable, feeds degrade to safe chronological or editorial ordering without an application error. |

## 8.4 R3 ranking policy

R3 estimates the expected **reader value** of showing a clip or thread. It is not a factual verdict and must never remove content because it holds an unpopular position. Hard safety and integrity eligibility is evaluated before ranking.

| Ranking layer | Included behavior | Prohibited behavior |
|---|---|---|
| Eligibility | Remove/withhold deleted, spam-flagged, muted, duplicated, or high-risk-unresolved material. | Withhold solely due to criticism of a powerful source or low popularity. |
| Source completeness | Reward direct source URL, clear attribution, usable excerpt, and reliable metadata. | Treat major publisher status as automatic quality. |
| Conversation quality | Consider substantive intent diversity, evidence attachments, Useful/Well-sourced feedback, and unresolved safety state. | Treat reply count, outrage, or raw reaction count as sufficient. |
| Relationship relevance | Consider explicit follows and selected topics. | Use private content, off-platform tracking, or sensitive inference. |
| Diversity | Limit repeated authors, domains, rooms, and perspective patterns. | Inject irrelevant content merely to meet a quota. |
| Freshness | Apply strong recency in Fresh Evidence and limited tie-break recency in Most Illuminating. | Suppress evergreen high-value threads simply because they are old. |

| Feed | Candidate set | Ordering | Safe fallback |
|---|---|---|---|
| Editor’s Picks | Active global/room curation | Curator priority, freshness, diversity | Chronological curated collection. |
| Most Illuminating | Public eligible threads with substantive signals | Source completeness, contextual quality, reactions, relevance, diversity | Editor’s Picks then Fresh Evidence. |
| Most Debated | Eligible threads with competing substantive branches | Intent/evidence plurality, quality, safety, diversity | Clear empty state or Most Illuminating. |
| Fresh Evidence | Recent public eligible clips | Recency, completeness, early substantive interaction, diversity | Latest chronological. |
| Following | Followed people, rooms, and sources | Relationship, recency, quality | Explicit no-follows onboarding. |

# 9. Shared implementation requirements

## 9.1 State model and domain entities

The exact field names may be reconciled with the existing Convex schema, but the product behavior below is required.

| Entity | Required contents | Release |
|---|---|---|
| `response` | Clip/thread reference, optional parent, author, intent, body/audio reference, publication/moderation status, timestamps, edit history. | R1 |
| `responseEvidence` | Response, kind, URL or internal annotation, optional excerpt, metadata state, source classification. | R1 |
| `responseReaction` | Response, user, one active reaction type, timestamps. | R1 |
| `contentReport` | Target, reporter, typed reason, notes, status, assignee, resolution, timestamps. | R1 |
| `publisherVerification` | User, owned source identity, verification method/status, audit timestamps. | R1 |
| `room` | Slug, mission, guide, topic, lifecycle, discovery state. | R2 |
| `roomMembership` | Room, user, role, following, notification level. | R2 |
| `roomPrompt` | Room, brief, start/end, status, creator. | R2 |
| `roomCuration` | Room, featured target, label/reason, curator, timestamp. | R2 |
| `userDiscoveryPreference` | Muted/reduced rooms and sources, personalization setting, timestamps. | R3 |
| `rankedImpression` | Viewer/session reference as appropriate, feed, item, rank, ranking version, reason codes, experiment, timestamp. | R3 |

## 9.2 Shared non-functional requirements

| Area | Requirement |
|---|---|
| Reliability | Response, reaction, follow, report, and moderation mutations are idempotent or safe to retry. A failed extraction never discards a contributor draft. |
| Performance | Thread and feed queries paginate server-side and do not load all replies. Ranking failure falls back to safe order rather than a failed feed. |
| Authorization | Room tools, publisher identity, moderation actions, reports, and mutations are enforced server-side, not by hidden UI alone. |
| Security | External URL previews are validated and sanitized; high-risk mutations are rate-limited; audit records are access-controlled. |
| Privacy | Analytics excludes raw bodies unless separately approved; individual reaction/report identities remain protected; users can manage discovery preferences. |
| Accessibility | New surfaces meet WCAG 2.2 AA intent: semantic controls, focus management, labeled icons, visible focus, keyboard operation, and non-color state. |
| Integrity | Source URLs, permalinks, editing state, moderation decisions, and report/action records are retained according to documented policy. |
| Observability | Monitor metadata extraction, composer errors, mutation failures, feed fallback rate, ranking eligibility/removal reasons, report queues, and notifications. |

# 10. Analytics, metrics, and experimentation

## 10.1 Required events

| Event | Required properties | Use |
|---|---|---|
| `thread_viewed` | Clip, feed/referrer, filter, viewer state, duration bucket | Reading depth and discovery quality. |
| `response_composer_opened` | Clip, entry point, viewer role | Contribution funnel. |
| `response_intent_selected` | Intent, evidence prompt state | Intent demand and friction. |
| `response_published` | Intent, evidence attached, room/prompt, latency bucket | Evidence-backed contribution rate. |
| `response_reacted` | Reaction, target intent, viewer role | Calibrate usefulness signals and detect abuse. |
| `thread_filter_selected` | Filter, result count | Validate contextual navigation. |
| `report_submitted` | Type, target, room, source-owner status | Safety and routing health. |
| `room_follow_changed` | Room, follow action, notification level | Room retention loop. |
| `prompt_contribution_published` | Room, prompt, type | Prompt effectiveness. |
| `ranked_item_impression` | Feed, rank version, reason codes, position | Audit/evaluate discovery. |
| `recommendation_feedback` | Action, item, room/source scope | Improve controls and ranking. |
| `outbound_source_clicked` | Clip, source domain, verification state | Quantify source/publisher value. |

## 10.2 Success metrics and guardrails

Capture at least two weeks of baseline before each public release where traffic permits. Initial thresholds are directional and must be calibrated to actual sample size.

| Release | Primary success metric | Decision signal | Guardrails |
|---|---|---|---|
| R1 | Evidence-backed contribution rate | Higher share of responses with explicit intent, meaningful body, and/or attached source than baseline. | No material rise in composer failures, report rate, or publishing latency. |
| R1 | Thread comprehension | Higher rate of second meaningful action after clip view: expand, filter, source click, follow, or response. | Anonymous reading completion must not decline materially. |
| R2 | Room return loop | Room followers have stronger 28-day return than comparable topic-only readers. | Monitor steward workload, reversal/appeal rate, and prompt fatigue. |
| R2 | Room quality | Room contributions show more substantive replies and sourcing than general feed contributions. | Standards must not disproportionately block new contributors. |
| R3 | Discovery value | Non-chronological feeds improve save/follow/source-click rate relative to Latest. | Monitor mute rate, diversity, safety reports, and creator/domain concentration. |
| R3 | Explanation/control coverage | Every personalized recommendation has a reason and feedback affordance; preference changes take effect within documented freshness window. | No reason exposes private behavior or sensitive inference. |

# 11. Governance and moderation policy requirements

Public standards must state that excerpts should be represented fairly; sources should be credited; interpretation must be distinguishable from fact; critiques must target claims rather than people; material conflicts should be disclosed; and verified source identity is not immunity from scrutiny. This is consistent with documented community practices emphasizing clear expectations, active moderation, quality rather than opinion, and source-aware discourse. [3] [4] [7]

| Area | Policy requirement | Owner |
|---|---|---|
| Misrepresentation | Allow challenge reports for materially misleading framing; reviewers may label, de-rank, hide, or remove under published policy. | Steward with platform escalation. |
| Conduct | Threats, personal attacks, targeted harassment, and coordinated pile-ons are restricted or removed. | Platform safety; stewards triage. |
| Rights | Fair-use/copyright claims follow the centralized claims process, not votes or room discretion. | Central claims workflow. |
| Publisher response | Verified owners may respond visibly; they cannot remove valid criticism based on disagreement. | Verification + platform policy. |
| Steward conflicts | Stewards disclose material conflicts and must not moderate direct conflicts. | Platform administrator. |
| Ranking safety | Serious open reports can withhold material from discovery pending review, with audit and due process. | Safety + ranking operator. |

# 12. Rollout plan and release gates

| Stage | R1 | R2 | R3 |
|---|---|---|---|
| Internal | Seed typed responses on selected clips; test migration, reactions, report routing, and publisher eligibility. | Pilot one internal room with staff/known Stewards. | Replay safe historical/public candidate sets; validate explanations and fallback paths. |
| Closed beta | Invite active contributors and a small publisher cohort; collect comprehension and misuse feedback. | Launch 2–3 rooms with named Stewards and limited prompt cadence. | Release one feed to opt-in cohort; compare to Latest with clear experiment holdout. |
| Public beta | Enable typed UI for new replies; preserve legacy presentation for existing comments. | Open selected public rooms; room creation remains platform-only. | Launch Editor’s Picks and Fresh Evidence, then Most Illuminating; gate Most Debated on safety readiness. |
| General availability | Meet success/guardrail thresholds; publish standards and role definitions. | Confirm room health, steward capacity, appeals, and on-call ownership before expansion. | Confirm audit logs, explanation coverage, controls, diversity and rollback before expanding personalization. |

Feature flags must independently support `typed_responses`, `response_evidence`, `thread_filters`, `publisher_response`, `room_core`, `room_prompts`, `room_moderation`, `discovery_editorial`, `discovery_quality_rank`, `discovery_debate`, and `discovery_personalization`. Flags must support per-room and per-cohort rollout, immediate rollback, and legacy fallback.

# 13. Dependencies, risks, and mitigations

| Risk/dependency | Impact | Mitigation | Release gate |
|---|---|---|---|
| Metadata/extraction failure | Evidence previews can be incomplete. | Preserve the URL, show extraction status, allow edit, and avoid promoting malformed previews. | R1 supports a transparent URL-only fallback. |
| Publisher verification ambiguity | Impersonation could undermine trust. | Verify ownership at domain/channel/creator level and retain audit history. | No Publisher response before verification. |
| Sparse early activity | New ranking could surface empty threads. | Editorial seeding, starter collections, deferred numeric counts, safe chronological fallback. | Exemplary R1 threads exist before default redesign. |
| Moderator overload | Reports/rooms can exceed capacity. | Start with few rooms, typed reasons, rate limits, escalation policy, and named on-call ownership. | No R2 expansion before workflow capacity review. |
| Rank feedback loops | Early reactions can entrench popularity/bias. | Cap/decay feedback, diversity re-rank, score hiding, audit ranking. | R3 requires concentration and quality monitoring. |
| Primary-source label misuse | Users may interpret label as factual endorsement. | Define source-type criteria, explain label, allow correction/report. | Criteria and reviewer process approved before R1 filters. |
| Legacy comment migration | Prior discussions lack intent/evidence data. | Preserve legacy display; use technical compatibility marker only; make migration reversible. | Backup and rollback test complete. |

# 14. Open decisions and assigned owners

| Decision | Proposed default | Recommended owner |
|---|---|---|
| Primary-source definition | Official records, first-person/first-party statements, original reporting/data; URL alone does not qualify. | Editorial + Trust/Safety |
| Intent editing | Allow in a short window; later edits preserve audit and display an edited label. | Product + Engineering |
| Expert roles | Begin with limited manual, room-scoped designation; do not launch credential marketplace. | Community + Operations |
| Launch rooms | Media & Accountability, Tech & AI, Climate, and Education, subject to named Steward availability. | Product + Editorial |
| Substantive-response definition | Intent plus minimum semantic-quality threshold; evidence or Useful/Well-sourced feedback strengthen it; length alone never determines it. | Product + Data |
| Rights/safety escalation | Name a platform owner and documented escalation path before publisher/room beta. | Operations |

# 15. References

[1]: https://annotated.sh/ "Annotated — live product"
[2]: https://github.com/tmoody1973/annotated "Annotated repository README and specification"
[3]: https://redditinc.com/policies/moderator-code-of-conduct "Reddit Moderator Code of Conduct"
[4]: https://support.reddithelp.com/hc/en-us/articles/15484546290068-Community-settings "Reddit Help: Community Settings"
[5]: https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations "Reddit Help: Approach to Content Recommendations"
[6]: https://support.reddithelp.com/hc/en-us/articles/19023371170196-What-is-the-Contributor-Quality-Score "Reddit Help: Contributor Quality Score"
[7]: https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette "Reddiquette"
