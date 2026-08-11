# Clerk Production Migration — make extension auth judge-testable

**Date:** 2026-05-28
**Status:** PLAN — review before executing. Most steps run through your dashboards (Clerk, DNS, Google/X OAuth, Vercel); a few are code/env changes I make.
**Why:** Judges install the extension and sign in against the **deployed** site. Clerk **dev** instances only support `syncHost` against `http://localhost`, so the extension can never pick up an annotated.sh session today. A Clerk **production** instance (custom domain + Pro, which you already have) is the only way `syncHost=https://annotated.sh` works for a judge.

## Current state (all dev instance)
- Clerk application's **Development** instance: `elegant-slug-68.clerk.accounts.dev` (`pk_test_…`).
- **Web** (Vercel `annotated` → annotated.sh): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test`, `CLERK_SECRET_KEY=sk_test`, `CLERK_ISSUER_DOMAIN=https://elegant-slug-68.clerk.accounts.dev`.
- **Convex** (`strong-eel-665`): `CLERK_JWT_ISSUER_DOMAIN=https://elegant-slug-68.clerk.accounts.dev`.
- **Extension** (stable CRX id `nenenpfdjkeaindoaiogleakhipggocc`): `pk_test`, `PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost`, `PLASMO_PUBLIC_WEB_URL=https://annotated-eight.vercel.app` (stale — wrong host).
- OAuth providers: **X + Google only** (per SPEC). On the dev instance these use Clerk's shared dev OAuth credentials.

## Decisions / assumptions (correct me before executing)
1. **Custom domain for Clerk Frontend API:** `clerk.annotated.sh` (CNAME-able subdomain of your apex). DNS for annotated.sh is managed where the domain lives (Vercel Domains or your registrar).
2. **Production OAuth credentials:** Clerk **production** instances do NOT use Clerk's shared OAuth — you must supply your **own** Google and X OAuth app credentials with production redirect URLs. (This is the most error-prone part.)
3. **Extension distribution for judges:** TBD and on the critical path — a judge must *install* it. Options: (a) Chrome Web Store (review lag, days), (b) a shareable unpacked/`.zip` "load unpacked" build + instructions. Pick one; (b) is bounty-timeline-friendly. The stable CRX id only holds if `key` stays pinned (it is).
4. **Cutover safety:** the live web app currently signs in fine on the dev instance. We do NOT swap web/Convex to prod until the prod instance + DNS + OAuth are fully green, so sign-in never breaks mid-flight. Dev instance remains the rollback.

## Migration steps

### Phase A — Stand up the production instance (you, Clerk dashboard)
- [ ] In the Clerk dashboard for this application, **Deploy to Production** (creates the Production instance; needs your Pro plan).
- [ ] Set the production **Frontend API custom domain** to `clerk.annotated.sh`. Clerk shows the required **DNS records** (CNAMEs for `clerk`, `clerk.accounts`, `clkmail`, plus DKIM).
- [ ] Add those DNS records wherever annotated.sh DNS lives (Vercel Domains / registrar). Wait for Clerk to verify (can take up to a few hours).
- [ ] Enable **Native API** (Native Applications) on the production instance — required for the extension.
- [ ] Confirm **bot protection is OFF** (unsupported in extensions).
- [ ] Copy the production **`pk_live_…`**, **`sk_live_…`**, and the prod **issuer** (`https://clerk.annotated.sh`).

### Phase B — Production OAuth (you, Google + X dashboards + Clerk)
- [ ] **Google:** in Google Cloud Console, add an OAuth 2.0 client (or reuse) with authorized redirect URI `https://clerk.annotated.sh/v1/oauth_callback`. Put the client id/secret into Clerk → Production → SSO Connections → Google (custom credentials).
- [ ] **X (Twitter):** same — register/confirm the X OAuth app with the prod callback `https://clerk.annotated.sh/v1/oauth_callback`, enter credentials in Clerk → Production → X.
- [ ] Verify email/password is still disabled and only X + Google show (SPEC).

### Phase C — Allowlist the extension origin (you, Clerk)
- [ ] In Clerk → Production → **Allowed Origins**, add `chrome-extension://nenenpfdjkeaindoaiogleakhipggocc`. (Dashboard, or `PATCH https://api.clerk.com/v1/instance` with the **sk_live** secret and `{"allowed_origins":["chrome-extension://nenenpfdjkeaindoaiogleakhipggocc"]}`.)

### Phase D — Convex (me + you for the secret)
- [ ] Update the Convex deployment env: `CLERK_JWT_ISSUER_DOMAIN=https://clerk.annotated.sh` (via `npx convex env set` — **gated**, ask first since it's the shared prod deployment). The `auth.config.ts` already reads this var, so no code change.
- [ ] (No schema/function change.)

### Phase E — Web app (me for code/env shape; you paste secrets) + redeploy
- [ ] In Vercel `annotated` project env (Production), swap: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…`, `CLERK_SECRET_KEY=sk_live_…`, `CLERK_ISSUER_DOMAIN=https://clerk.annotated.sh`. Leave the 4 sign-in/up URL vars as-is.
- [ ] Redeploy web (prod). Verify sign-in on annotated.sh still works (now via the prod instance + your prod OAuth apps).

### Phase F — Extension (me: code/env + rebuild + package)
- [ ] Update `apps/extension/.env`: `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…`, `PLASMO_PUBLIC_CLERK_SYNC_HOST=https://annotated.sh`, `PLASMO_PUBLIC_WEB_URL=https://annotated.sh` (fix the stale annotated-eight URL). Keep `CRX_PUBLIC_KEY` (stable id).
- [ ] Confirm `host_permissions` covers `https://annotated.sh/*` and `https://clerk.annotated.sh/*` (current `https://*/*` already does, but consider tightening).
- [ ] `pnpm build` → produce `build/chrome-mv3-prod`. Package per the chosen distribution (zip for "load unpacked", or Web Store submission).

### Phase G — Verify (me, live)
- [ ] Sign in on annotated.sh (prod instance, X or Google). Load the packaged extension, open the panel, **close + reopen** (SDK refresh quirk). Confirm it shows your name (synced session), then publish a YouTube clip **with a topic** and confirm it lands in the room. Also re-confirm podcast/article (dev-token) paths still work.

## Risks / notes
- **Biggest risk = OAuth misconfig** (Phase B): wrong redirect URIs ⇒ sign-in 400s. Test web sign-in (Phase E) before touching the extension.
- **DNS propagation** (Phase A) gates everything; start it first.
- **Don't break the working dev path:** keep the dev instance intact; if prod cutover misbehaves, revert the Vercel + Convex env to the `pk_test`/`elegant-slug-68` values (kept in the current `.env.local`).
- **Convex env change is on the shared prod deployment** — gated, ask before `convex env set`.
- This is **independent of the topics PR (#1)**, which is already shipped + reviewed. Sequence it after #1 merges (or alongside — no code overlap).
- **Extension distribution** is the other half of "judge-testable" — decide Web Store vs shareable unpacked build early; Web Store review has lead time.

## What I can do vs what needs you
- **Me (code/env files + rebuild + verify):** extension `.env` + rebuild/package (Phase F), web env *shape* guidance, Convex `env set` (gated), live verification (Phase G), the `api.clerk.com` allowlist call **if** you hand me a scoped sk_live (or you do it).
- **You (accounts/secrets/DNS):** Clerk Deploy-to-Production + custom domain + DNS records + Native API (Phase A), Google/X prod OAuth apps (Phase B), Allowed Origins (Phase C), pasting `pk_live`/`sk_live` into Vercel (Phase E), distribution choice (Phase F).
