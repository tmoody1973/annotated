# Handoff — 2026-08-16, evening

Continues `2026-08-16-handoff.md`, which covered this morning. Everything below
is either deployed or explicitly marked as not deployed. Eleven commits,
`d5f49da` → `60fc5da`, all pushed.

**Read first if you read nothing else:** the Fly worker is deliberately NOT
deployed, and deploying it before the new extension clears store review will
blank the transcript screen for anyone who already installed. See Landmines.

---

## The one thing waiting on a clock

**Chrome extension 0.4.2 was submitted for review today.** Everything else
downstream waits on it:

```
web (done) ──► extension 0.4.2 (in review) ──► worker (HELD)
                                                   │
                                     long podcasts become clippable
                                                   │
                                        the flagship clip can be made
```

When Tarik says review passed: deploy the worker, then add the long-podcast
bullet to the changelog (deliberately left out — see below).

---

## What happened today

### The bug that mattered most

Spiking a named risk before building on it found a **live defect nobody had
hit**: podcast episodes over roughly **70 minutes could not be stored at all.**

A real 99-minute All-In episode transcribes to 17,637 words. Stored as one
object per word — repeating the keys `word`, `startMs`, `endMs`, `speaker`,
`confidence` 17,637 times — that is **1,501,754 bytes against Convex's 1MB
document limit.** It would silently fail. Every podcast on the platform is a
15–30 minute NPR or Marketplace segment, so nothing had reached it. A judge
clipping any normal interview show would have.

Fixed by storing words as **columns instead of objects**: same episode, **409,831
bytes, 39% of the limit**, verified by round-tripping all 17,637 real words
through the shipped encoder with an exact match. A three-hour episode now fits.

Speed was the risk I expected and it was a non-issue — Deepgram returned 99
minutes in **20 seconds**.

`decodeWords` reads both formats, so **no migration and no schema change**. An
array means legacy; `{v:2,...}` means columnar. The worker now takes a real
dependency on `@annotated/shared` so encoder and decoder cannot drift; the
Dockerfile always assumed this and package.json had never declared it.

### The Receipt Chain — designed, built, shipped, proven

The session's main feature. Spec at
`docs/superpowers/specs/2026-08-16-receipt-chain-design.md`.

A reply now states **what it is doing** (context / challenge / support /
question) and can carry **a receipt** — another clip on Annotated, or any link.
A cited clip renders with **a real player**, not a citation. That was the whole
reason it was built on replies rather than first-class response clips: whether a
counter-clip reads as an argument or a footnote turned out to be a *rendering*
decision, not an architectural one.

Verified live on annotated.sh, not only in tests: posting a Challenge with a
clip attached put **two players on one page** — the claim at the top, the receipt
inside the reply, each linking to its own episode.

Four rules that make it honest, each answering a specific failure:

- `source_response` exists in the schema but the composer **refuses** it —
  otherwise anyone could mint a reply that reads as the source owner's.
- A cited clip is **re-checked on every read**, not just at write time, because
  it can be removed after being cited. Removal has to mean removal on every
  surface that can reach the row.
- An unsourced challenge **publishes and is labelled**, never blocked. Nobody
  should be stopped from disagreeing for want of a link.
- No `javascript:` or `file:` receipts — these become user-controlled hrefs.

**The right of reply** appears the moment a visible challenge exists and
disappears when the last one is deleted. Both confirmed in the browser. Unfilled
it names whose seat it is and offers "Is this you?", writing to the
`publisherWaitlist` table that already existed and until now had no reason to.

### A false changelog line, mine, found and fixed

v0.4.2 claimed *"You can delete a note you left on someone's clip."*
`comments.remove` and its `isOwn` projection shipped this morning — **but nothing
in the web app ever called them.** No control existed anywhere. I wrote that
entry from the backend being done without checking a person could reach it.

Fixed the product rather than the sentence. Delete now exists with a confirm
step, and a removed note renders "This note was deleted." instead of a blank row.

**The lesson worth carrying: a shipped mutation is not a shipped feature.**

### Everything else

| | |
|---|---|
| Removed clips said "Clip processing…" forever | now a real tombstone; `noindex` |
| The removed take leaked in 3 more places | OG unfurl, share card, thread page — one guard in `toLandingView` |
| Site said the extension was "in Chrome Web Store review" | now links the real listing; install steps collapse behind a summary |
| Edit/remove left you on a stale page | `router.refresh()` — the tombstone was unreachable from the only button that makes one |
| Privacy contact | `annotated@tarikos.app` |
| Editor's Picks were 2 articles | now 3 podcasts on top, with takes written to replace "interesting" ×4 |

---

## Current state

| | |
|---|---|
| Branch | `main`, everything pushed |
| Web | deployed, verified live |
| Convex | deployed to `strong-eel-665` (schema + Receipt Chain) |
| Extension | **0.4.2 submitted to the store, in review** |
| Worker | **NOT deployed — held on purpose** |
| Tests | backend 137, shared 158, worker 77, extension 106, web 13 |

### Deploy commands that actually work

```bash
# Web — from the repo ROOT. I tripped this three times today.
vercel --prod --yes

# Worker — from the ROOT, explicit config + dockerfile. DO NOT RUN YET.
fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile .

# Convex functions — NOT `convex deploy`
cd packages/backend && npx convex dev --once
```

---

## The flagship clip — chosen and confirmed

```
All-In E58 · published 11 December 2021
3,056,805 ms → 3,063,710 ms   (50:56.8 → 51:03.7, 6.9s)

"So obviously the market corrects, everybody always asks us as a group,
 what happens when the market corrects? Well, here you're about to see it."
```

He then plays the Better.com CEO firing 900 people over Zoom, three weeks before
Christmas. Published three weeks after the NASDAQ peak and months before the 2022
drawdown; roughly 400,000 tech layoffs followed.

**Attribution was confirmed by Tarik listening**, not by diarization — Deepgram
split four hosts into nine clusters. The speaker was identified from the
transcript (he gives the episode intro, addresses the others by name) and then
verified by ear. Do not weaken this: the spec's own gate is that misquoting a
real person on a page calling itself a receipt is worse than shipping nothing.

**The polarity is deliberate.** An earlier draft was "here's where he
contradicted himself." That makes the judge defensive *while he is judging*.
"Here's the receipt that he called it first" is something he is incentivised to
repost — which turns the demo into distribution. Same mechanic, opposite outcome.

**Still open:** the confirming half. A later episode where the call is borne out
has not been chosen. 408 episodes back to March 2020 are in the feed; two were
searched.

---

## Next, in order

### 1. A typed report path — DONE (`e7380f8`, live on annotated.sh)

Shipped as a separate `reports` table, not a field on `claims`: a claim needs a
named claimant who can be answered in law, a report must be fileable
anonymously. Six categories, details required, email optional. Public
unauthenticated mutation → scheduled internal action → Resend, same shape as
`claims.submit`, and both now share one `sendOwnerEmail`. `reports:listOpen` is
internal-only. Verified live: real submit on a thread page → row in
`strong-eel-665` → Resend accepted. Changelog v0.4.3.

**Carried debt:** no rate limit on `reports.submit`, same as claims debt (s).
One test row (`TEST REPORT — ignore`) is still open in the table.

<details><summary>Original brief</summary>

The only report path on the platform is **File a Claim, which is copyright.**
There is no way to report a misleading excerpt, missing context, wrong
attribution, harassment or spam. The campaign PRD flagged this (R1-F7) and it
was skipped.

This ships **before the 2026 feed is promoted anywhere.** A public election feed
open to contributions with nowhere to report anything is the one combination not
to ship. It is small — the same shape as `claims.submit`.
</details>

### 2. The 2026 Record

Spec: `docs/superpowers/specs/2026-08-16-the-2026-record-design.md`.

A live election feed where **a machine keeps the record and people supply the
meaning.** Each row is a verified public source — body, jurisdiction, status,
retrieval date, selection note. Takes hang off the source they belong to. A
source nobody has annotated says **"Needs a take"** and offers the one action
that fixes it.

The organising rule: **the agent does the evidence, and never the take.** That
is a position, not a limitation — it makes the machine structurally incapable of
the part that matters and turns the gap into the invitation.

Two properties enforced server-side, not by anyone remembering: **a machine
proposes, a person publishes**, and record entries carry an **editorial byline
that is never a personal account**.

Reuses `sources`, `annotations`, `topics` and the existing `ArticleClipModal`
composer. One new table.

Feel study that settled the design (private, real facts, not on the site):
https://claude.ai/code/artifact/8b1dce7a-777d-4a20-baaa-cf75cfc8fb2d

**Verified facts for seeding** (checked today, do not re-guess): Wisconsin votes
3 Nov 2026; Governor is **Crowley (D) v Tiffany (R)**, open seat, Evers not
running; Josh Kaul (D) defends AG; **Wisconsin has NO US Senate seat this cycle**
(Johnson to 2029, Baldwin to 2031); nationally 33 Senate seats are up (20 R-held,
13 D-held) against a 53–47 R majority, Democrats need net +4; Microsoft's Mount
Pleasant expansion (15 more data centres, TID 5) was approved unanimously in
January while a Caledonia proposal twelve miles away was withdrawn after
opposition; Gallup (2–18 Mar 2026, n=1,000) has 71% opposing a data centre in
their own area, 25% in favour — **a national number, not a Wisconsin one.**

### 3. The curation agent

Deliberately last. It drafts record entries into the review queue from named
Wisconsin sources (WPR, Wisconsin Examiner, WUWM, Isthmus, official bodies) and
never publishes.

**Content first, automation second** — the lesson twice today. The record is
useful with ten hand-made entries, and hand-making them is how we learn whether
the fields are the right fields. An agent writing into an unused shape automates
a guess.

Evidence it is buildable: selecting the flagship clip *was* this agent, run by
hand — pull the feed, choose by title, transcribe, search for prediction
language, map speakers, verify. It worked on the second episode.

---

## Landmines

- **`vercel --prod` must run from the repo ROOT.** From `apps/web` it links to a
  stray `web` project and fails at `npm install` — after printing a Production
  URL, so it *looks* like it worked. I hit this three times in one session.
- **The store extension id is `ddhdbmdojahejnkbkfdciclknecfopod`.** A memory note
  said `ckmfcnbemkahpcdkijaohhfbocjdpaoo` for 75 days; that was a pre-upload
  guess, never the assigned id, and it was one deploy from shipping as the site's
  store link. Corrected at source. **Never trust a store id not read off the live
  listing.**
- **Do not deploy the worker until extension 0.4.2 is live.** The published 0.4.1
  build parses `wordsJson` by hand and renders an **empty transcript screen**
  against a columnar row — the podcast path's core surface, blank, for anyone who
  already installed. Memory: `worker-deploy-held-for-store`.
- **The long-podcast fix is deliberately absent from the changelog.** It is
  committed and the web half is live, but the worker is held, so episodes over
  ~70 minutes still fail. Claiming it now would be a false entry. Add it when the
  worker ships.
- **Deepgram research ≠ the product pipeline.** Both transcripts made today were
  direct `curl` calls to Deepgram (~78¢ total). Nothing was written to Convex. No
  source, transcript or annotation exists for All-In.
- **A shipped mutation is not a shipped feature.** `comments.remove` existed all
  day with no UI, and I put it in the changelog anyway. Check the call site.
- **Convex `--prod` is wrong here.** `strong-eel-665` is labelled "dev" and is
  what the site reads.

---

## Two accounts

Tarik has more than one user row — some clips are authored by `@tarik-moody`,
others by `@tarik-moody-2`, and one by `dev`. Owner controls only appear for the
signed-in row, so **some of his own clips are not editable by the account he
uses.** The Snap Judgment clip (the best audio in the database — a man crying as
he describes seeing his kids after prison) is bylined `Dev Seed` and already has
a vote, so its take is locked at "fire escape" permanently. Re-clipping it from
his own account would be the strongest single item on the homepage.
