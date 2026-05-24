import { v } from "convex/values";
import {
  mutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

// Fair-use claims are the app's only public (unauthenticated) write surface — a
// party disputing a clip is not necessarily a signed-in user — so inputs are
// validated hard and length-capped here.
const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 320; // RFC 5321 maximum
const MAX_REASON_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rejects control characters (incl. newlines/tabs) that could corrupt the email header. */
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

const CLAIM_RECIPIENT_FALLBACK = "tarik@radiomilwaukee.org";
const CLAIM_SENDER = "Annotated Claims <onboarding@resend.dev>";
const SITE_BASE_URL_FALLBACK = "http://localhost:3000";

/**
 * Persists a fair-use dispute and schedules the owner notification. Public and
 * unauthenticated by design (SPEC: visible "File a claim" on every annotation).
 * Convex has no DB triggers, so the external Resend call runs as a scheduled
 * internal action rather than inline (a mutation can't perform a fetch).
 */
export const submit = mutation({
  args: {
    annotationId: v.id("annotations"),
    claimantName: v.string(),
    claimantEmail: v.string(),
    reason: v.string(),
  },
  returns: v.id("claims"),
  handler: async (ctx, args) => {
    const claimantName = args.claimantName.trim();
    const claimantEmail = args.claimantEmail.trim();
    const reason = args.reason.trim();

    if (claimantName.length === 0) {
      throw new Error("Your name is required.");
    }
    if (claimantName.length > MAX_NAME_LENGTH) {
      throw new Error("Name is too long.");
    }
    if (hasControlCharacters(claimantName)) {
      throw new Error("Name contains invalid characters.");
    }
    if (claimantEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(claimantEmail)) {
      throw new Error("A valid email is required.");
    }
    if (reason.length === 0) {
      throw new Error("Please describe the issue.");
    }
    if (reason.length > MAX_REASON_LENGTH) {
      throw new Error("Description is too long.");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("This annotation no longer exists.");
    }

    const claimId = await ctx.db.insert("claims", {
      annotationId: args.annotationId,
      claimantName,
      claimantEmail,
      reason,
      submittedAt: Date.now(),
      status: "open",
    });

    await ctx.scheduler.runAfter(0, internal.claims.notify, { claimId });
    return claimId;
  },
});

/**
 * Open claims for manual review (no moderation queue in v1). Internal-only —
 * the claims table holds claimant PII and dispute text, so it is reachable only
 * via the Convex CLI/dashboard (`convex run claims:listOpen`), never the client.
 */
export const listOpen = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("claims")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .collect();
  },
});

/** Internal read so the notify action can load the claim it was scheduled for. */
export const getClaim = internalQuery({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.claimId);
  },
});

/**
 * Emails Tarik about a new fair-use claim via Resend. Scheduled by `submit`.
 * Recipient and site base URL are env-overridable so the live test can target a
 * Resend-verified address (the `onboarding@resend.dev` sender only reaches the
 * account's own email until a domain is verified).
 */
export const notify = internalAction({
  args: { claimId: v.id("claims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured on Convex.");
    }

    const claim = await ctx.runQuery(internal.claims.getClaim, {
      claimId: args.claimId,
    });
    if (!claim) {
      return null; // Claim was deleted before the notification fired.
    }

    const recipient = process.env.CLAIM_NOTIFY_TO ?? CLAIM_RECIPIENT_FALLBACK;
    const baseUrl = process.env.SITE_BASE_URL ?? SITE_BASE_URL_FALLBACK;
    const annotationLink = `${baseUrl}/a/${claim.annotationId}`;

    const lines = [
      "A new fair-use claim was filed on Annotated.",
      "",
      `Claimant: ${claim.claimantName}`,
      `Email: ${claim.claimantEmail}`,
      "",
      "Reason:",
      claim.reason,
      "",
      `Annotation: ${annotationLink}`,
    ];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CLAIM_SENDER,
        to: [recipient],
        reply_to: claim.claimantEmail,
        subject: `Fair-use claim from ${claim.claimantName}`,
        text: lines.join("\n"),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend rejected the claim email (${response.status}): ${detail}`);
    }

    return null;
  },
});
