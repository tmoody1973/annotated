import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getConvexToken } from "./auth-token";

const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL ?? "";

export const CONVEX_TIMEOUT_MS = 25000;
export const CONVEX_UNREACHABLE =
  "Couldn't reach Annotated's servers. Check your connection and try again.";

/** Rejects with a clear message if a Convex call stalls, so publish never spins
 *  forever when the deployment is unreachable (e.g. a network/firewall dropping
 *  the connection — the WebSocket-1006 case). */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/** Mirrors the Clerk identity into a `users` row, idempotently. The web app runs
 *  this on sign-in, but a user who only ever authed through the extension's
 *  syncHost may not have a row yet — and the publish mutations derive the author
 *  from it. */
const ensureCurrentUser = makeFunctionReference<"mutation", Record<string, never>, string>(
  "users:ensureCurrentUser"
);

/** Thrown when a publish is attempted with no Clerk session — the caller prompts
 *  sign-in rather than silently attributing the clip to the dev seed user. */
export class NotSignedInError extends Error {
  constructor() {
    super("Sign in on the web app, then close and reopen this panel, to publish.");
    this.name = "NotSignedInError";
  }
}

/**
 * A client with no identity, for the calls that genuinely need none. Used by
 * the chapter lookup so a signed-out user still gets help choosing a clip.
 */
export function buildPublicClient(): ConvexHttpClient {
  if (!convexUrl) {
    throw new Error("Missing PLASMO_PUBLIC_CONVEX_URL");
  }
  return new ConvexHttpClient(convexUrl);
}

/**
 * Creates an authed one-shot ConvexHttpClient for the signed-in Clerk user.
 * Throws NotSignedInError when no token is available. Guarantees the users
 * row exists before the caller uses the client to derive the author.
 *
 * Shared by every module that needs to reach Convex as the signed-in user — the
 * panel's reactive ConvexProvider carries no Clerk token (see sidepanel.tsx), so
 * anything auth-gated goes through this one-shot client instead.
 */
export async function buildAuthedClient(): Promise<ConvexHttpClient> {
  if (!convexUrl) {
    throw new Error("Missing PLASMO_PUBLIC_CONVEX_URL");
  }
  const token = await getConvexToken();
  if (!token) throw new NotSignedInError();
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  // Guarantee the users row exists before deriving the author from it.
  await withTimeout(client.mutation(ensureCurrentUser, {}), CONVEX_TIMEOUT_MS, CONVEX_UNREACHABLE);
  return client;
}
