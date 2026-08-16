# The 2026 Record — design

**Date:** 2026-08-16
**Status:** Approved design, not yet planned or built
**Depends on:** the Receipt Chain (`2026-08-16-receipt-chain-design.md`), shipped
**Scope:** One release — a live, seeded election feed. The curation agent that
fills it automatically is a **separate, later spec**; see §9.

---

## 1. What this is

A dedicated feed for the 2026 election where **a machine keeps the record and
people supply the meaning.** Each row is a verified public source — what it is,
which body decides it, its status, when it was retrieved. Takes hang off the
source they belong to. A source nobody has annotated says so, and offers the
one action that fixes that.

> The agent does the evidence. It never does the take.

That is a product position, not a limitation. Annotated's own line is *the clip
is the evidence, the take is the point*; this makes the machine structurally
incapable of the part that matters, and turns the gap it leaves into the
invitation.

## 2. The problem it actually solves

Annotated's failure mode is not missing features. It is that there is nothing in
it to react to. As of today: ~40 clips, two real accounts, almost no comments,
and Editor's Picks that had to be curated by hand this morning because the
takes on the existing podcast clips were the word "interesting" four times.

A social product with an empty room does not get conversation by adding
furniture. The hardest step in Annotated has never been writing the take — it is
**finding something worth clipping.** `BUILD-INTENT.md` identified this as
amplifier #1, "smart clip suggestions," and it was never built. This is that
idea, aimed at something where the evidence genuinely matters.

The election supplies what a demo cannot: real stakes, a real deadline, a
natural cadence of change, and a local audience who cares.

## 3. Scope

### In

- A `/2026` feed, record-first, publicly readable without an account.
- A `recordEntry` — a curated editorial layer over an existing `source`.
- Takes attached to the source they belong to, with counts.
- A **needs-a-take** state and a one-click path into the existing composer.
- An **editorial byline** distinct from any human account.
- A **human publish gate**: nothing reaches the feed unreviewed.
- Published selection rules, on the page.

### Out — and why

| Not building | Reason |
|---|---|
| The curation agent | Separate spec. It has nowhere to write until the record exists, and hand-seeding proves the design first. §9. |
| State editions, stewards, roles | The campaign PRD's R2. Needs staff. One campaign, one curator. |
| Quality ranking, Most Debated | The PRD's R3. Needs a corpus. |
| Personalisation, notifications | Later. |
| Predictions, endorsements, scorecards | Never. See §7. |

## 4. Data model

Reuse `sources`, `annotations`, `topics`, `annotationTopics` — all of which
exist. Add one table.

```ts
recordEntries: defineTable({
  /** Which campaign this belongs to, so a later one reuses the machinery. */
  campaign: v.string(),                    // "2026"
  sourceId: v.id("sources"),

  jurisdiction: v.string(),                // "Racine County"
  body: v.string(),                        // "Mount Pleasant Village Board"
  /** The bounded question this record answers a piece of. */
  question: v.string(),
  status: v.union(
    v.literal("proposed"), v.literal("under_review"),
    v.literal("hearing_scheduled"), v.literal("decided"),
    v.literal("withdrawn"), v.literal("preliminary"),
    v.literal("certified"), v.literal("archived"),
  ),
  retrievedAt: v.number(),
  /** Why it is on the record, and one honest limitation of it. Factual. */
  selectionNote: v.string(),
  nextDateAt: v.optional(v.number()),
  nextDateLabel: v.optional(v.string()),

  curatedBy: v.union(v.literal("agent"), v.literal("editor")),
  /** Undefined means drafted and awaiting review. The publish gate. */
  publishedAt: v.optional(v.number()),
})
  .index("by_campaign_and_published", ["campaign", "publishedAt"])
  .index("by_source", ["sourceId"])
```

**Why a new table rather than fields on `sources`.** `sources` is joined by every
clip on the platform; hanging civic status and curatorial notes off it would
make a general-purpose row carry campaign concerns forever. The record is an
editorial layer over sources, and it should be removable without touching them.

**Takes are just annotations.** A take on a record entry is an ordinary
annotation whose `sourceId` matches and which carries the campaign topic. No new
concept, and the Receipt Chain already carries the argument beneath it.

## 5. Behaviour

### 5.1 The record

- `/2026` lists published entries for the campaign, newest first, readable
  signed out.
- Every row shows: source title and link, body, jurisdiction, status, retrieval
  date, next key date when known, and the selection note.
- Status renders as **words**, never colour alone.
- A row shows its take count. **Zero takes renders as `Needs a take`** with an
  `Add yours` action — not as an empty space.

### 5.2 Adding a take

- `Add yours` opens the existing composer (`ArticleClipModal`) with the source
  URL prefilled, so the contributor's first action is the valuable one.
- Signed out, it prompts sign-in and returns to the same row.
- A take published this way is tagged to the campaign topic automatically.
- Nothing about the flow is campaign-specific beyond the prefill — it is the
  ordinary publish path, reached from a better starting point.

### 5.3 The publish gate

- A `recordEntry` with no `publishedAt` is invisible to every public query.
- Only an operator can publish one. In this release that is a Convex internal
  mutation; the agent spec adds a review queue UI.
- **A machine may propose. A person publishes.** This is the property that makes
  a one-person civic feed defensible, and it is enforced server-side rather than
  by anyone remembering.

### 5.4 The editorial byline

- Record entries are attributed to a visible editorial identity, never to a
  personal account.
- A reader can always tell which parts a machine selected and which a person
  meant. Blurring that is the single fastest way to lose the trust the whole
  product is built on.

## 6. What a row looks like

```
── THE RECORD ──────────────────────────────

  MOUNT PLEASANT · site plans, 15 data centres
  Village Board · Racine County · approved Jan 2026
  "On the record because the same company's proposal
   twelve miles away was withdrawn. Limitation: the
   contract retains a provision regulators struck down."
    ↳ 2 takes ▸

  CALEDONIA · proposal withdrawn
  Village of Caledonia · Jan 2026
    ↳ NEEDS A TAKE        [ Add yours ]
```

## 7. Rules the feed holds itself to

Published on the page, so selection can be argued with rather than guessed at.

- No endorsement, no scorecard, no advice on how to vote, no predictions.
- Every claim carries its document and its retrieval date.
- Preliminary results stay labelled preliminary until a body certifies them.
- Election dates link to the state authority, never a summary of one.
- Interpretation is visibly separate from the source.
- Anyone named can respond, and a response cannot delete the criticism it
  answers — the Receipt Chain's right-of-reply already does this.

## 8. Risks

| Risk | Mitigation |
|---|---|
| **No moderation surface.** A public feed open to contributions, and the only report path on the platform is File a Claim, which is copyright. The PRD flagged this (R1-F7) and it was skipped. | **Blocking.** A typed report path — misleading excerpt, missing context, wrong attribution, harassment, spam — ships before this feed is promoted anywhere. |
| Accusations of partisan selection | Rules published up front; symmetric sourcing; takes come from contributors, not the platform; every entry human-reviewed and dated. |
| An empty feed reads worse than none | Seed by hand before launch. Same lesson as Editor's Picks this morning — the design teaches nothing without content in it. |
| Contribution never starts | The honest answer is distribution, not features: a Milwaukee broadcast audience who cares that the Milwaukee County Executive is running for governor. No other entrant has an audience at all. |
| Scope creep toward a political product | One campaign, one curator, an explicit end date. The record archives after certification rather than becoming a permanent section. |

## 9. The curation agent — deliberately a separate spec

The agent drafts `recordEntries` into the review queue from a named list of
Wisconsin sources (WPR, Wisconsin Examiner, WUWM, Isthmus, plus official
bodies), and never publishes.

It is split off for a reason learned twice today: **content first, automation
second.** The record is useful with ten hand-made entries, and hand-making them
is how we find out whether the fields are the right fields. An agent writing
into a shape nobody has used yet would automate a guess.

Selecting the flagship clip for the Receipt Chain was this agent run by hand:
pull the feed, choose by title, transcribe, search, verify, attribute. It worked
on the second episode. That is the evidence it is buildable, and the argument
for building the target first.

## 10. Open decisions

| Decision | Proposed default | Owner |
|---|---|---|
| Route | `/2026`, rendering a campaign-flavoured topic room | Claude |
| Editorial identity name | To decide — must not read as a person | Tarik |
| Ten seed entries | Governor race, AG, the data-centre case file, WEC canvass | Tarik + Claude |
| Whether the record archives or persists after 3 Nov | Archives, read-only, status history intact | Tarik |

## 11. Related

- `2026-08-16-receipt-chain-design.md` — the reply layer this feed relies on
- `docs/annotated-improvements/annotated_2026_midterm_campaign_prd_final.md` —
  the source document, whose staffed-state-edition scope is deliberately not built
- The feel study that settled the design direction, built 16 Aug 2026
