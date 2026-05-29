import { Component, useEffect, useState, type ReactNode } from "react";
import { ClerkProvider, useUser } from "@clerk/chrome-extension";
import { accent, sansStack, valid } from "../lib/clip-styles";

const CHROME_TEXT = "#ffffff";

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? "";
const webUrl = process.env.PLASMO_PUBLIC_WEB_URL ?? "";
const extensionUrl = chrome.runtime.getURL(".");

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

/** Synced from the web session. While loading or signed-out shows "Sign in";
 *  when signed-in shows a green dot + the user's name. After signing in on the
 *  web app, the panel must be closed and reopened to refresh (SDK limitation). */
function AuthStatus() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn) return <SignInLink />;
  const name = user.firstName ?? user.username ?? "you";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: CHROME_TEXT }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: valid }} />
      {name}
    </span>
  );
}

/** Catches any render error from ClerkProvider so a Clerk failure degrades to a
 *  plain "Sign in" link instead of blanking even this widget. */
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
 * Logged-in status for the sidebar header — DELIBERATELY isolated. Clerk wraps
 * only this widget (not the panel) and Convex is NOT coupled to it, so Clerk
 * failing/hanging can blank at most this small slot, never the clip composer.
 * Real per-user attribution (authed publish) is a separate, later step that
 * would reintroduce the Convex↔Clerk coupling carefully.
 */
export function AuthSlot() {
  // Clerk's syncHost handshake only runs when this provider first mounts, and the
  // SDK does not auto-refresh auth state in a side panel. So when the panel regains
  // focus (e.g. the user just signed in on the web tab and switched back), remount
  // the provider via a changing `key` to force a fresh handshake — this removes the
  // documented "close and reopen the side panel" step.
  const [syncKey, setSyncKey] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setSyncKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!publishableKey || !syncHost) return <SignInLink />;
  return (
    <AuthErrorBoundary key={syncKey}>
      <ClerkProvider
        publishableKey={publishableKey}
        syncHost={syncHost}
        afterSignOutUrl={extensionUrl}
        signInFallbackRedirectUrl={extensionUrl}
        signUpFallbackRedirectUrl={extensionUrl}
      >
        <AuthStatus />
      </ClerkProvider>
    </AuthErrorBoundary>
  );
}
