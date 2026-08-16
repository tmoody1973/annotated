# The Receipt Chain — design

**Date:** 2026-08-16
**Status:** Approved design, not yet planned or built
**Scope:** One release. Evidence-bearing replies plus a reserved right of reply.

---

## 1. What we are building, in one paragraph

A reply on Annotated gains two things: a stated **purpose**, and an optional
**receipt**. The receipt can be another Annotated clip or an external link, and
an attached clip renders as a full player — not a footnote. The result is an
argument you can *listen to*: a claim on top, a counter-claim underneath, each
anchored to the real episode it came from. When a clip is challenged, a **right
of reply** slot appears directly beneath it, reserved for whoever owns the
source, at the same visual weight as the challenge.

Nobody else in this bounty can render that. It requires word-level audio
timestamps, and the other entrants treated podcasts as a checkbox.

---

## 2. Decision record

**Decision.** Build evidence-bearing replies on the existing `comments` table,
rather than implementing the R1 / R2 / R3 releases described in
`docs/annotated-improvements/`.

**Why this came up.** Three planning documents (909 lines) propose typed
response intents, stewarded topic rooms, quality-aware ranking, and a national
midterm campaign with staffed state editors. They are good strategy. They are
also written for a company with staff, and the immediate goal is a $5,000 bounty
judged by one person, alone, on the criterion *"the cleanest and most complete
execution wins."*

The problem is that nearly every mechanic in those documents needs **other
people** to be worth anything. Typed intents need responders. Rooms need
stewards and members. Ranking needs a corpus. Annotated today has roughly forty
annotations, two real accounts plus `dev`, and almost no comments. A partially
built social layer shows a judge an empty evidence map, a room with one member,
and a "Most Debated" feed with nothing in it. That reads as scaffolding, and it
moves the judging criterion in the wrong direction.

**Options considered.**

| Option | Real cost |
|---|---|
| Build R1 as specified (10 requirements incl. publisher verification, thread filters, evidence map, reaction overhaul) | Weeks of work whose value is invisible without a crowd. A verification system nobody uses. |
| Evidence-bearing replies — a stated purpose plus an attached clip, rendered as a full card | The counter-clip has no landing page of its own. It lives inside the argument rather than standing alone. |
| First-class response clips — a reply *is* an annotation with its own page, votes, share card | Creates a new class of annotation. `isVisible` already had to be threaded through six listing queries; this adds a seventh question to every one of them, plus changes to the four-screen extension flow. |
| A hand-curated evidence chain — author assembles clips into one composed artifact | Best single demo, but it is a publishing tool, not a mechanic. It proves you can make one beautiful thing, not that the platform makes them. |

**What we chose and why.** Evidence-bearing replies (joint: Claude proposed,
Tarik chose). It buys the entire visual payoff of first-class response clips for
a fraction of the surface area, because *"does this read as a footnote or as an
argument"* turns out to be a rendering decision rather than an architectural
one. It is also the only option that is simultaneously small, reusable by other
people, and the natural output format for the curation agent planned next.

**What we gave up.** A counter-clip is not independently citable. It has no page,
no vote count, and does not appear in its author's profile as its own work. If
counter-clipping becomes a primary behaviour, that will need revisiting, and
promoting a reply into a first-class annotation later means a migration we have
not designed.

**How we will know if this was right.** A reader who lands on the flagship
thread plays both clips and follows at least one source link. Concretely: the
`outbound_source_clicked` rate on threads with attached evidence exceeds that of
threads without.

**What actually happened.** _(Tarik fills this in.)_

---

## 3. Scope

### In

- A `intent` on replies: **Add context**, **Challenge with a source**,
  **Support with a source**, **Ask a question**.
- An optional receipt on a reply: another Annotated clip, or an external URL.
- An attached clip renders as a full player card with a link to its source.
- A **right of reply** slot that appears on a clip once it has been challenged.
- Two seeded exemplar threads.

### Out — and why

| Not building | Reason |
|---|---|
| **Correct a factual point** intent | Overlaps Challenge. Five options on an empty platform is a menu with nothing behind it. |
| **Publisher response** as a selectable intent | Requires verified domain ownership. A badge anyone can pick is worse than no badge. The *slot* is reserved now; the identity system comes later. |
| Thread filters (All / Counterpoints / Primary sources) | Absurd with three replies. Follow-on. |
| Reaction overhaul (Useful / Well-sourced / Needs context) | Replaces the working vote system, which recomputes counts from rows to stay drift-proof. Real regression risk, no demo value. Follow-on. |
| External-URL metadata extraction | The worker can already do this (`/extract-article`). Deliberately deferred — v1 stores the URL and shows the domain. |
| Rooms, ranking, the midterm campaign as a product | Separate specs. The midterm work is a time-boxed probe, not a permanent feature. |

---

## 4. Data model

Three optional fields on `comments`. Nothing else moves.

```ts
comments: defineTable({
  annotationId, authorId, text, createdAt, parentId?, removedAt?,  // existing

  /** What this reply is doing. Absent means a pre-Receipt-Chain reply, which
   *  renders exactly as it always has — no label, no retroactive claim that it
   *  was sourced. `source_response` is never offered in the composer; it is
   *  placed only through the right-of-reply slot. */
  intent: v.optional(v.union(
    v.literal("context"),
    v.literal("challenge"),
    v.literal("support"),
    v.literal("question"),
    v.literal("source_response"),
  )),

  /** A receipt: another clip on Annotated, or a link. At most one. */
  evidenceAnnotationId: v.optional(v.id("annotations")),
  evidenceUrl: v.optional(v.string()),
})
```

**Every field is optional on purpose.** Existing replies stay valid and render
unchanged. No migration, no backfill. This mirrors the transitional pattern the
codebase already uses for `takeText` / `commentaryText`.

### Why not a separate `responseEvidence` table

The PRD proposes one. It is right for a world where a reply carries several
pieces of evidence with extraction state and source classification. We allow at
most one receipt and do no extraction, so a table would be one join for no gain.
Splitting it out later is mechanical.

---

## 5. Behaviour and acceptance criteria

### 5.1 Posting a reply with a purpose

- The composer shows all four selectable intents with a one-line explanation.
  **Add context** is preselected.
- Choosing **Challenge** or **Support** promotes the receipt field and changes
  its helper text. It does not make it mandatory.
- A Challenge or Support posted with no receipt still publishes, and is labelled
  **Unsourced** in the thread.
- Intent renders as **words**, never colour alone.
- A failed submit never discards the draft.

### 5.2 Attaching a receipt

- The author may paste an `http(s)` URL, or pick one of their own published
  clips from a list.
- At most one receipt per reply. Setting one clears the other.
- **Validation, server-side:**
  - `evidenceAnnotationId` must exist, be `isPublic`, and **not be removed**.
    A removed clip must never be resurrected as somebody's evidence.
  - `evidenceAnnotationId` may not equal the reply's own `annotationId`
    (a clip cannot cite itself).
  - `evidenceUrl` must parse, be `http` or `https`, and be length-capped.
  - Both absent is valid.
- Validation lives in the Convex mutation, not the UI.

### 5.3 Rendering a receipt

- An attached **clip** renders as a full card: player, source byline, and a link
  to its own landing page. It reuses `ClipMediaLive`, so processing, failed and
  ready states are handled the same way they are everywhere else.
- An attached **URL** renders as its domain plus the link. No fake preview.
- **If the attached clip is later removed**, the card degrades to a short
  "this clip was removed" line and keeps the reply readable. Today's tombstone
  work already blanks the removed clip's content server-side, so no take text
  can leak through the evidence card.

### 5.4 The right of reply

- The slot appears on a clip **if and only if** at least one visible reply has
  intent `challenge`. No challenge, no slot, no clutter.
- It renders **directly beneath the clip and above the thread**, at the same
  visual weight as a challenge card.
- Unfilled, it reads: *Right of reply — reserved for {source name}. Is this you?*
  with a **Claim this source** action that writes to the existing
  `publisherWaitlist` table.
- Filled, it shows the response with a **Response from the source** label.
- A source response **cannot** hide, delete, de-rank, or outrank the challenge.
  It occupies its reserved position and nothing more.
- In v1 only an operator can place one, through an internal mutation. Real
  domain verification is a follow-on.

### 5.5 What a logged-out reader can do

Read everything: replies, intents, receipts, the reserved slot, and every source
link. Sign-in is required only to post, attach, or claim a source.

---

## 6. Seeded content

Two threads. The mechanic is worthless without something in it, and the source
documents say so themselves: *"Exemplary R1 threads exist before default
redesign."*

**Thread 1 — the flagship. Selected and confirmed 2026-08-16.**

| | |
|---|---|
| Episode | All-In **E58**, published **11 December 2021** |
| Title | *November's CPI, preparing for a downturn, macro outlook, Better.com's botched layoffs* |
| Feed | `https://rss.libsyn.com/shows/254861/destinations/1928300.xml` |
| Audio | `dts.podtrac.com/redirect.mp3/traffic.libsyn.com/secure/allinchamathjason/ALLIN-E58.mp3` |
| Span | **3,056,805 ms → 3,063,710 ms** (50:56.8 → 51:03.7, 6.9s) |
| Speaker | Jason Calacanis — **confirmed by Tarik listening to the cut audio**, not by diarization alone |

> "So obviously the market corrects, everybody always asks us as a group, what
> happens when the market corrects? Well, here you're about to see it."

He then plays the Better.com CEO firing 900 people over Zoom, three weeks before
Christmas.

**Why it qualifies as a receipt.** The episode published 11 December 2021, three
weeks after the NASDAQ peak of 19 November 2021 and months before the 2022
drawdown. The prevailing read at the time was that the wobble was temporary; he
called it the start of a correction and pointed at its first visible symptom.
What followed was roughly 400,000 tech layoffs across 2022–2023.

**It also demonstrates the product on its own.** The clip *contains* a clip —
Jason playing someone else's audio to make a point about it, source named, four
years before Annotated existed. That is the thesis, on tape.

**Provenance of the timestamps.** Word boundaries come from Deepgram `nova-3`
with `diarize` and `smart_format` — the same model and options
`deepgram-client.ts` sends — so the published clip will land on exactly this
span. Diarization split four hosts into nine clusters and could not be trusted
for attribution on its own; the speaker identification was made from the
transcript (he gives the episode intro and addresses the others by name) and
then **verified by ear** before selection.

**The confirming half is still open.** A second clip from a later episode where
the call is borne out has not been chosen, and needs the same treatment. The
thread works with the single clip plus a written take; the second clip makes it
stronger.

The polarity matters and is a deliberate reversal of the first draft. A thread
whose punchline is *"here is where he contradicted himself"* makes the judge
defensive during the judging window. A thread whose punchline is *"here is the
receipt that he was right early"* is something he is incentivised to share —
which turns the demo into distribution. The mechanic is identical either way.

Its right-of-reply slot will read **"Reserved for All-In — is this you?"**

**Thread 2 — not about tech.** One thread from a different domain, so the
flagship does not read as a party trick. Music, civic, or sport. Tarik picks.

**Accuracy is a hard gate.** Misquoting a real person on a page that presents
itself as a receipt would be worse than shipping nothing. Every quote is checked
against the transcript and every timestamp is played back before publishing.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| ~~**Long-episode transcription.**~~ **RESOLVED 2026-08-16 — the spike found a live bug and it is fixed.** A real 99-minute All-In episode transcribed to 17,637 words and **1,501,754 bytes, 143% of Convex's 1MB document limit** — it would not have stored. At ~15KB per minute the break-even was near 70 minutes, so every podcast episode longer than that was silently unstorable; nothing had hit it because the platform's podcasts are 15–30 minute NPR and Marketplace segments. Fixed in `83ce343` by storing words as columns instead of one object per word: the same episode is now **409,831 bytes, 39%**. Speed was never the problem — Deepgram returned 99 minutes in **20 seconds**. | **Dependency: the worker deploy is held** until the updated extension is live on the Chrome Web Store, because the published build parses `wordsJson` by hand and would render an empty transcript against a columnar row. Deploy order: web (done) → extension → worker. **The flagship cannot be produced until the worker ships.** |
| The counter-clip is an efficient context-collapse tool. Two clips years apart, side by side, both looking official. | The right-of-reply slot exists precisely to answer this, and appears automatically on challenge. Longer term: source verification, and a published standard that an excerpt must not misrepresent its source. |
| Evidence pointing at a clip that later fails or is removed. | Covered by 5.2 validation and 5.3 degradation. Both paths get a test. |
| The rest of the site has no typed replies, so the exemplars look inconsistent. | Intents are available everywhere from day one; legacy replies render unchanged. The exemplars are seeded, not special-cased. |
| Seeded threads read as staged. | Everything is real: real clips, real episodes, real links. Nothing is mocked. |

---

## 8. Testing

- **Convex tests** (the existing `convex-test` harness) for: intent accepted and
  persisted; unsourced challenge publishes and is flagged; removed clip rejected
  as evidence; self-citation rejected; non-`http(s)` URL rejected; both-absent
  valid; right-of-reply slot appears only when a visible challenge exists.
- **Web:** the evidence card renders a player for a clip, a domain for a URL, and
  a removal notice for a removed clip.
- One end-to-end pass in a signed-in browser, since the composer is auth-gated
  and no automated profile is signed in.

---

## 9. Follow-ons, in order

1. Domain verification, turning the reserved slot into a self-serve one.
2. External-URL metadata extraction, reusing the worker's Readability path.
3. Thread filters, once threads are big enough to need them.
4. Promoting a reply to a first-class response clip with its own page.
5. Reactions (Useful / Well-sourced / Needs context) replacing votes.

---

## 10. Open decisions

| Decision | Proposed default | Owner |
|---|---|---|
| ~~Which All-In prediction to use~~ | **Closed 2026-08-16** — E58 @ 50:56.8, see §6 | Tarik (confirmed by ear) |
| Which later episode confirms the call | Unresolved. 408 episodes back to Mar 2020 are in the feed; two were searched | Tarik + Claude |
| Thread 2's subject | Non-tech, Tarik's choice | Tarik |
| Whether the intent picker appears on feed cards or only landing pages | Landing pages only in v1 | Claude |
| Wording of the Unsourced label | "Unsourced" | Tarik |

---

## 11. Related

- `BUILD-INTENT.md` — the audio-first thesis this serves
- `docs/annotated-improvements/` — the three source documents this deliberately
  does not implement in full
- Next spec: the midterm curation probe (an agent plus a themed landing page,
  time-boxed, not a permanent feature)

### A finding that belongs to the next spec

Selecting the flagship clip meant doing by hand what the curation agent is meant
to automate: pull the feed, choose a likely episode from its title, transcribe
it, search the text for prediction language, map speaker clusters to people,
read the passage. Two episodes in, it produced a usable receipt.

**The entire All-In archive — 408 episodes back to March 2020 — is in a public
RSS feed, and the existing pipeline can already clip every one of them** (the
podtrac redirect chain resolves to `206 audio/mpeg`, which `resolveFinalUrl`
already handles). At Deepgram's rate the whole archive transcribes for roughly
$150.

That makes "point the curation agent at podcast archives" not a different
project from the civic one but the same machinery aimed at a corpus that (a)
already exists, (b) needs no editorial judgement about political balance, and
(c) feeds the audio wedge directly. Worth weighing when the agent is specced.
