import { createClerkClient } from "@clerk/chrome-extension/client";

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? "";

/**
 * Fetches a Convex-templated Clerk JWT for the signed-in user, or null when
 * signed out. Headless (no React provider) so it stays isolated from the panel's
 * reactive ConvexProvider — it only runs inside the publish handler's try/catch,
 * never during render, so a failure surfaces as a publish error, never a blank.
 *
 * `background: true` is required for the headless client to complete the syncHost
 * handshake and expose `clerk.session` (without it the session reads null even
 * when the web app is signed in). The "convex" template matches `auth.config.ts`'s
 * `applicationID` — the same token the web app uses to authenticate Convex.
 *
 * A null `session` means signed-out (caller prompts sign-in); a thrown error
 * (e.g. a missing JWT template or network failure) is intentionally NOT swallowed
 * so the real cause shows instead of a misleading "sign in" message.
 */
export async function getConvexToken(): Promise<string | null> {
  if (!publishableKey || !syncHost) return null;
  const clerk = await createClerkClient({ publishableKey, syncHost, background: true });
  if (!clerk.session) return null;
  return await clerk.session.getToken({ template: "convex" });
}
