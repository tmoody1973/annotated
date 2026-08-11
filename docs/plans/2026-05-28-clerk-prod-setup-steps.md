# Clerk Production Instance — Step-by-Step Setup (annotated.sh)

This is the dashboard/DNS/OAuth runbook for **Phases A–C** of the Clerk production migration. Work top to bottom. Fill in the **VALUE TO COLLECT** blanks as you go — the filled-in form at the bottom is exactly what you hand back to me so I can run Phases D–G (Convex + web + extension + verify).

Context: today everything runs on the **development** instance `elegant-slug-68.clerk.accounts.dev`. Target custom domain for the production Frontend API: **`clerk.annotated.sh`**. OAuth providers: **Google + X only** (email/password disabled). Extension stable origin: **`chrome-extension://nenenpfdjkeaindoaiogleakhipggocc`**.

> Heads-up: SSO connections, Integrations, and Paths do NOT carry over from dev → prod. You will reconfigure OAuth from scratch on the production instance.

---

## Phase A — Create the production instance + custom domain

### A1. Create the production instance
1. Open the **Clerk Dashboard** for the application that owns `elegant-slug-68` (the one whose dev keys the app uses now).
2. Top of the page, click the **Development** instance switcher → **Create production instance**.
3. When prompted, choose **Clone development settings** (keeps your user-facing config close to dev). You'll still re-add OAuth.
4. You're now on the **Production** instance. The dashboard home shows a checklist of remaining requirements + a **Deploy certificates** button (greyed until DNS verifies).

### A2. Set the application/custom domain
1. Go to **Domains** (left nav) on the **Production** instance.
2. Set your production domain to **`annotated.sh`** (your app's root domain). Clerk derives the Frontend API at **`clerk.annotated.sh`**.
3. Clerk now displays a list of **DNS records to add**. They're generated for your domain — **copy them exactly from the dashboard**, don't guess. You'll see roughly these (names vary slightly):
   - `clerk` → CNAME → `frontend-api.clerk.services` (Frontend API)
   - `accounts` → CNAME → `accounts.clerk.services` (Account Portal)
   - `clkmail` → CNAME → `mail.…clerk.services` (email)
   - `clk._domainkey` and `clk2._domainkey` → CNAME (DKIM, email auth)
   - **VALUE TO COLLECT → paste the actual records Clerk shows in the form at the bottom.**

### A3. Add the DNS records
1. Go to wherever **annotated.sh DNS** is managed (Vercel → the `annotated` project → Domains, or your registrar).
2. Add each CNAME exactly as Clerk listed (host + target). Do **not** proxy them through Cloudflare orange-cloud if applicable — Clerk needs direct CNAMEs.
3. Back in Clerk → Domains, wait for each record to flip to **Verified** (minutes to a few hours; up to 48h worst case).

### A4. Native API + bot protection (required for the extension)
1. Clerk → **Native Applications** (or "Native API" toggle) on the Production instance → **enable Native API**. The Chrome extension's `createClerkClient` depends on this.
2. Clerk → **Attack protection / Bot protection** → ensure **bot protection is OFF** (Cloudflare bot detection breaks extension auth).

### A5. Deploy certificates
1. Once DNS is verified, click **Deploy certificates** on the Production home. Wait for SSL to provision.
2. **VALUE TO COLLECT → production issuer:** confirm it is `https://clerk.annotated.sh` (Clerk → API Keys shows the Frontend API URL).

### A6. Grab the production API keys
1. Clerk → **API Keys** (Production instance).
2. **VALUE TO COLLECT → `pk_live_…`** (Publishable key) and **`sk_live_…`** (Secret key). Keep `sk_live` private.

---

## Phase B — Production OAuth (Google + X)

> Production uses **your own** OAuth apps, not Clerk's shared dev credentials. Do Google first (easier), then X.

### B1. Google
1. Clerk → **SSO Connections** (Production) → **Add connection** → **For all users** → **Google**.
2. Toggle **Enable for sign-up and sign-in** AND **Use custom credentials**.
3. Clerk now shows an **Authorized Redirect URI** — **copy that exact value** (do not hand-type it).
   - **VALUE TO COLLECT → Google redirect URI (the exact string Clerk shows).**
4. In **Google Cloud Console** → APIs & Services → Credentials → **Create OAuth client ID** (Web application):
   - **Authorized redirect URIs:** paste the value from step 3.
   - **Authorized JavaScript origins:** `https://annotated.sh` (and `https://www.annotated.sh` if used).
   - Scopes: the defaults Clerk requests (email, profile, openid) — no extra config needed.
5. Copy the Google **Client ID** + **Client Secret** → paste into Clerk's Google connection fields → **Save**.

### B2. X (Twitter)
1. Clerk → **SSO Connections** (Production) → **Add connection** → **X/Twitter**. (Use the same OAuth version your dev instance uses — X has "Twitter v1" and "X (OAuth 2.0)"; match what works today.)
2. Toggle **Enable** + **Use custom credentials**. Copy the **Authorized Redirect URI / callback** Clerk shows.
   - **VALUE TO COLLECT → X redirect/callback URI.**
3. In the **X Developer Portal** → your app → Auth settings: add the callback URL from step 2, set the website URL to `https://annotated.sh`.
4. Copy X's **Client ID / API Key + Secret** → paste into Clerk's X connection → **Save**.

### B3. Confirm provider parity with the SPEC
- Only **X + Google** enabled; **email/password disabled** (Clerk → User & Authentication → Email/Password = off, matching dev).

---

## Phase C — Authorize the extension + web origins

### C1. Allowed Origins (for the extension's syncHost)
- Clerk → Production → **Allowed Origins** (or via API). Add: **`chrome-extension://nenenpfdjkeaindoaiogleakhipggocc`**
- API alternative (run with your `sk_live`): `curl -X PATCH https://api.clerk.com/v1/instance -H "Authorization: Bearer sk_live_…" -H "Content-Type: application/json" -d '{"allowed_origins":["chrome-extension://nenenpfdjkeaindoaiogleakhipggocc"]}'`
- (If you'd rather I run that, hand me a `sk_live` — otherwise do it in the dashboard.)

### C2. authorizedParties (security, recommended)
- In the web app's Clerk middleware config we'll set `authorizedParties: ["https://annotated.sh", "chrome-extension://nenenpfdjkeaindoaiogleakhipggocc"]` — I'll handle this code-side in Phase E/F; no dashboard action.

---

## When done — hand this filled-in form back to me

```
pk_live key:                 pk_live_________________________________
sk_live key (or "done in dashboard" if you ran C1 yourself):  ________
Production issuer:           https://clerk.annotated.sh   (confirm? Y/N)
DNS records: all Verified in Clerk?                          Y / N
Native API enabled?                                          Y / N
Bot protection OFF?                                          Y / N
Certificates deployed (SSL green)?                           Y / N
Google connection: custom creds saved + enabled?            Y / N
X connection: custom creds saved + enabled?                 Y / N
Allowed Origins includes chrome-extension://nenenpfdjkeaindoaiogleakhipggocc?  Y / N
Extension distribution decision (Web Store / unpacked zip):  ____________
```

With that, I run:
- **D:** `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://clerk.annotated.sh` (I'll confirm before touching the shared deployment).
- **E:** swap Vercel `annotated` prod env (`pk_live`/`sk_live`/issuer), redeploy, verify **annotated.sh web sign-in first**.
- **F:** extension `.env` → `pk_live` + `syncHost=https://annotated.sh` + `WEB_URL=https://annotated.sh`, rebuild + package.
- **G:** live verify — sign in on annotated.sh, load extension, close/reopen panel, publish a clip with a topic.

## Gotchas
- **Test web sign-in (Phase E) before the extension.** OAuth redirect-URI typos surface there and are easier to debug on the web than in the panel.
- DNS first — it's the long pole.
- Keep the dev instance + current `pk_test` env values intact as rollback; don't delete anything.
  - After signing in on the web, the side panel needs a **close + reopen** to pick up the session (Clerk SDK limitation, not a bug).	
