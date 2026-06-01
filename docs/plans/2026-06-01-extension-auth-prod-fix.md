# Extension publish broke after the Clerk production cutover — what happened and how we fixed it

**Date:** 2026-06-01
**Status:** Fixed + verified (a real clip published to production from the extension).
**One-line version:** Moving Clerk from its permissive *development* mode to strict *production* mode exposed a real limitation — a browser extension can't mint a login token directly against production Clerk — so we now mint the token inside an open annotated.sh tab (where it works) and hand it back to the extension.

---

## The goal

A judge installs the Chrome extension, signs in, clips a video, and hits **Publish**. For that to work, the extension needs to prove *who the user is* to our backend (Convex). It does that with a short-lived **login token** issued by Clerk (our identity service).

## What changed right before it broke

We completed the **Clerk production cutover** — switching the whole app (web + database + extension) from Clerk's **development** instance to its **production** instance (`clerk.annotated.sh`). This was required: development Clerk only works on `localhost`, so a judge on the live site could never sign in through it.

Web sign-in kept working perfectly (we confirmed it — signed in, commented, voted). But **publishing from the extension started failing.**

## What we saw (the symptoms, in order)

Each attempt to publish from the extension threw a different error, which is what made this confusing:

1. `For security purposes, only one of the 'Origin' and 'Authorization' headers should be provided, but not both.`
2. `Sign in on the web app, then close and reopen this panel, to publish.` (even though signed in)
3. `Clerk: Network request failed while offline.` (even though the browser was online)

They look unrelated, but they're all the **same underlying problem** showing up in different places.

## The root cause (plain English)

Think of Clerk as a **passport office** and the login token as a **freshly stamped visa** the extension needs each time it publishes.

To get that stamped visa, the extension has to make a request to the passport office (`clerk.annotated.sh`) that proves it already has a valid passport. There are two ways to prove it:

- **A cookie** — like showing a badge you're already wearing. The browser sends it automatically *only to sites on the same family domain.*
- **An `Authorization` header** — like handing over your passport number in the request itself.

Here's the trap:

- The extension lives at a `chrome-extension://…` address. That is **not** in the `annotated.sh` family, so the browser **refuses to send the cookie** (cross-site cookies are blocked).
- With no cookie available, Clerk's code falls back to sending the **`Authorization` header** instead.
- But the browser **also automatically attaches an `Origin` header** to that request (it always does, and you can't turn it off).
- **Production Clerk has a security rule: a request may carry the cookie/Origin path *or* the Authorization path — never both.** Seeing both, it rejects the request.

So from the extension's own address, there is **no valid way** to ask for the token: the cookie can't be sent, and the Authorization fallback gets blocked by the Origin rule. Depending on exactly where this failed (a background worker vs. a page), Clerk reported it as the "Origin/Authorization" error, a generic "offline" error, or simply "no token → please sign in."

## Why it worked before, on the development instance

This is the key question, and the answer is reassuring: **nothing in our code regressed.** Development Clerk is deliberately lenient in ways production is not:

1. **Dev doesn't enforce the "Origin *or* Authorization, not both" rule.** That hardening is **production-only**. On dev, the exact same request was simply accepted.
2. **Dev uses a special "dev-browser" token** that works from *any* address, including `chrome-extension://`. So the extension could prove itself without needing the cross-site cookie at all.
3. **Dev's sync target was `localhost`** with wide-open rules.

So the development environment was quietly hiding a real constraint. The production cutover — which we *had* to do for judges — swapped the lenient environment for the strict one and revealed it.

## The fix

We mint the token **where it actually works: inside an open annotated.sh tab.**

An `annotated.sh` page **is** in the same family as `clerk.annotated.sh`, so its cookie flows normally, no `Authorization` fallback is needed, and there's no Origin conflict. Your web sign-in already proved that context works.

So when you publish from the extension:

1. The extension's **background worker** looks for an open `annotated.sh` tab.
2. It runs a tiny snippet **inside that tab** that asks Clerk for the token (`getToken({ template: "convex" })`) — exactly as the website itself does.
3. The token is handed back to the extension, which uses it to publish to Convex.

Robustness details: it tries **every** open annotated.sh tab (in case you have more than one), and it **waits for Clerk to finish loading** the session in that tab before asking. A nice side effect: the Clerk SDK is no longer bundled into the background worker, so the packaged extension went from a bloated ~44 MB back down to **~3.5 MB**.

### What you need for it to work

- **An annotated.sh tab must be open and signed in.** This fits the judge flow naturally: signing in opens an annotated.sh tab, and that's exactly the tab the extension borrows the token from. If no such tab is open, the extension says: *"Open annotated.sh in a tab (you're signed in there), then publish."*

## How we proved it works

A real clip published from the extension to production:
`https://annotated.sh/a/chicagoans-pay-respects-to-jesse-jackson-as-cross-…` → **HTTP 200**, real clip page. Publishing requires an authenticated Convex write, so a live published clip is end-to-end proof the token now works.

## Files changed

- `apps/extension/background.ts` — the service worker now mints the token via the annotated.sh tab relay (replacing the direct Clerk call).
- `apps/extension/lib/auth-token.ts` — the panel just message-passes to the worker for the token.

Commit: `fix(extension): mint Convex token via web-tab relay (prod Clerk)`.

## Honest notes / trade-offs

- **The relay needs an open, signed-in annotated.sh tab.** Today that's guaranteed by the sign-in flow. A future hardening could auto-open a hidden tab if none exists, so publishing never depends on the user keeping the tab around.
- This is a workaround for a genuine Clerk limitation (extension → production custom-domain token minting). It's a known rough edge in Clerk's Chrome-extension support; the relay is the pragmatic, reliable path.

## Still queued (separate from this fix)

- **"Clip resets when you switch tabs"** — the side panel is tied to the active tab, so switching away drops the in-progress clip. Fix = persist the in-progress clip per video and restore it on return.
- **Distribution** — submit the 3.5 MB `chrome-mv3-prod.zip` to the Chrome Web Store, then set `NEXT_PUBLIC_EXTENSION_URL` so every CTA points at the real listing instead of `/extension`.
