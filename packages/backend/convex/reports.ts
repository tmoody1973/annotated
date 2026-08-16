import { v } from "convex/values";
import { mutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendOwnerEmail, siteBaseUrl } from "./ownerEmail";

// Conduct/context reports are public and unauthenticated for the same reason
// claims are: the person best placed to spot a misleading excerpt is usually
// not the person who posted it, and often not signed in at all. Inputs are
// validated hard and length-capped here.
const MAX_DETAILS_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 320; // RFC 5321 maximum
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const categoryValidator = v.union(
  v.literal("misleading_excerpt"),
  v.literal("missing_context"),
  v.literal("wrong_attribution"),
  v.literal("harassment"),
  v.literal("spam"),
  v.literal("other")
);

/** Human-readable labels for the notification email. */
const CATEGORY_LABELS: Record<string, string> = {
  misleading_excerpt: "Misleading excerpt",
  missing_context: "Missing context",
  wrong_attribution: "Wrong attribution",
  harassment: "Harassment",
  spam: "Spam",
  other: "Other",
};

/** Rejects control characters (incl. newlines/tabs) that could corrupt the email header. */
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Persists a conduct/context report and schedules the owner notification.
 * Public and unauthenticated by design. Mirrors `claims.submit`: a mutation
 * cannot `fetch`, so the email runs as a scheduled internal action.
 */
export const submit = mutation({
  args: {
    annotationId: v.id("annotations"),
    category: categoryValidator,
    details: v.string(),
    reporterEmail: v.optional(v.string()),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const details = args.details.trim();
    const reporterEmail = args.reporterEmail?.trim();

    if (details.length === 0) {
      throw new Error("Please describe the problem.");
    }
    if (details.length > MAX_DETAILS_LENGTH) {
      throw new Error("Description is too long.");
    }
    if (reporterEmail !== undefined && reporterEmail.length > 0) {
      if (
        reporterEmail.length > MAX_EMAIL_LENGTH ||
        hasControlCharacters(reporterEmail) ||
        !EMAIL_PATTERN.test(reporterEmail)
      ) {
        throw new Error("That email address doesn't look right.");
      }
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("This annotation no longer exists.");
    }

    const reportId = await ctx.db.insert("reports", {
      annotationId: args.annotationId,
      category: args.category,
      details,
      ...(reporterEmail ? { reporterEmail } : {}),
      submittedAt: Date.now(),
      status: "open",
    });

    await ctx.scheduler.runAfter(0, internal.reports.notify, { reportId });
    return reportId;
  },
});

/**
 * Open reports for manual review (no moderation queue in v1). Internal-only —
 * reports carry reporter contact details and accusations about named people,
 * so they are reachable via `convex run reports:listOpen`, never the client.
 */
export const listOpen = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .collect();
  },
});

/** Internal read so the notify action can load the report it was scheduled for. */
export const getReport = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

/** Emails the site owner about a new report via Resend. Scheduled by `submit`. */
export const notify = internalAction({
  args: { reportId: v.id("reports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.runQuery(internal.reports.getReport, {
      reportId: args.reportId,
    });
    if (!report) {
      return null; // Report was deleted before the notification fired.
    }

    const label = CATEGORY_LABELS[report.category] ?? report.category;
    const lines = [
      "A new report was filed on Annotated.",
      "",
      `Category: ${label}`,
      `Reporter: ${report.reporterEmail ?? "(anonymous)"}`,
      "",
      "Details:",
      report.details,
      "",
      `Annotation: ${siteBaseUrl()}/a/${report.annotationId}`,
    ];

    await sendOwnerEmail({
      subject: `Report: ${label}`,
      text: lines.join("\n"),
      ...(report.reporterEmail ? { replyTo: report.reporterEmail } : {}),
    });

    return null;
  },
});
