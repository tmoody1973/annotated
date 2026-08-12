import { Component, type ReactNode } from "react";
import { openSignIn, useAuthState } from "../lib/use-auth-state";
import { accent, sansStack, valid } from "../lib/clip-styles";

const CHROME_TEXT = "#ffffff";

/** Opens the web app's sign-in (OAuth can't run in the panel; syncHost delegates). */
function SignInLink() {
  return (
    <button
      type="button"
      onClick={openSignIn}
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
