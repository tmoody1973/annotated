import { Component, useEffect, useState, type ReactNode } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getConvexToken } from "../lib/auth-token";
import { accent, sansStack, valid } from "../lib/clip-styles";

const CHROME_TEXT = "#ffffff";

const webUrl = process.env.PLASMO_PUBLIC_WEB_URL ?? "";
const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL ?? "";

const currentUserRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { displayName: string; username: string } | null
>("users:currentUser");

/** Opens the web app's sign-in (OAuth can't run in the panel; syncHost delegates). */
function SignInLink() {
  return (
    <button
      type="button"
      onClick={() => void chrome.tabs.create({ url: `${webUrl}/sign-in` })}
      style={{
        fontFamily: sansStack,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: accent,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      Sign in
    </button>
  );
}

type AuthState =
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
function useAuthState(): AuthState {
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
            : { status: "signed-out" }
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

function AuthStatus() {
  const state = useAuthState();
  if (state.status !== "signed-in") return <SignInLink />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: CHROME_TEXT }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: valid }} />
      {state.name}
    </span>
  );
}

/** Catches any render error from AuthStatus so a failure degrades to a plain
 *  "Sign in" link instead of blanking even this widget. */
class AuthErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render(): ReactNode {
    return this.state.failed ? <SignInLink /> : this.props.children;
  }
}

/**
 * Logged-in status for the sidebar header — DELIBERATELY isolated. A failure
 * here can blank at most this small slot, never the clip composer. Publishing
 * already goes through the same token relay (buildAuthedClient in
 * lib/convex-client.ts); this widget just also asks Convex who that token
 * belongs to, for display.
 */
export function AuthSlot() {
  return (
    <AuthErrorBoundary>
      <AuthStatus />
    </AuthErrorBoundary>
  );
}
