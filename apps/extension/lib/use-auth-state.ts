/**
 * Who is signed in, as far as the panel can tell.
 *
 * Extracted from `auth-slot.tsx` so the Source screen can ask the same question
 * the header does — first run and the sign-in gate both hang off it — without a
 * second, subtly different copy of the relay logic.
 */
import { useEffect, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getConvexToken } from "./auth-token";

const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL ?? "";

const currentUserRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { displayName: string; username: string } | null
>("users:currentUser");

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; name: string };

/**
 * Mints a token via the same web-tab relay `background.ts` uses for publish
 * (see docs/plans/2026-06-01-extension-auth-prod-fix.md — a chrome-extension://
 * origin can't complete Clerk's production auth handshake directly), then reads
 * the signed-in user's name off Convex. A null token means the relay found no
 * signed-in annotated.sh session — "Sign in" is the right and only distinguishable
 * message, since the relay already auto-opens a hidden tab when none is open, so
 * there's no separate "no tab open" state left to report.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setState({ status: "loading" });
      try {
        const token = await getConvexToken();
        if (!token || !convexUrl) {
          if (!cancelled) setState({ status: "signed-out" });
          return;
        }
        const client = new ConvexHttpClient(convexUrl);
        client.setAuth(token);
        const user = await client.query(currentUserRef, {});
        if (cancelled) return;
        setState(
          user
            ? { status: "signed-in", name: user.displayName || user.username }
            : { status: "signed-out" },
        );
      } catch {
        if (!cancelled) setState({ status: "signed-out" });
      }
    }

    void load();

    // The relay has no way to push us an update when the user signs in on the
    // web tab, so re-check when the panel regains focus (matches the old
    // ClerkProvider-remount behaviour, minus the "close and reopen" step).
    const refresh = (): void => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return state;
}

/** Opens the web app's sign-in. OAuth cannot run inside the panel's origin. */
export function openSignIn(): void {
  const webUrl = process.env.PLASMO_PUBLIC_WEB_URL ?? "";
  void chrome.tabs.create({ url: `${webUrl}/sign-in` });
}
