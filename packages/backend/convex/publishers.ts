import { v } from "convex/values";
import { mutation } from "./_generated/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 200;

/**
 * Public, unauthenticated waitlist signup for publisher accounts (the
 * /publishers page). Validates + normalizes the email and dedupes by it, so a
 * repeat signup is idempotent. The app's only other public write is
 * `claims.submit`; this mirrors its validate-hard, no-auth shape.
 */
export const submitWaitlist = mutation({
  args: { email: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase().slice(0, EMAIL_MAX);
    if (!EMAIL_RE.test(email)) {
      throw new Error("Enter a valid email address");
    }
    const existing = await ctx.db
      .query("publisherWaitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!existing) {
      await ctx.db.insert("publisherWaitlist", { email, createdAt: Date.now() });
    }
    return { ok: true };
  },
});
