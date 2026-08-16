import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedClip(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: "https://example.com/ep58",
      title: "All-In E58",
    });
    return await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      clipStartMs: 3_056_805,
      clipEndMs: 3_063_710,
      takeText: "He called the correction.",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
      ...overrides,
    });
  });
}

/** A signed-in user plus a clip of their own, the setup nearly every test wants. */
async function setup() {
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: "clerk_reader", name: "Reader" });
  const userId = await user.mutation(api.users.ensureCurrentUser, {});
  const claimId = await seedClip(t, userId);
  return { t, user, userId, claimId };
}

describe("stating what a reply is doing", () => {
  test("records the intent it was posted with", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Worth noting the CPI print that week.",
      intent: "context",
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.intent).toBe("context");
  });

  test("a reply posted without one stays legacy, not silently relabelled", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Just a comment.",
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.intent).toBeNull();
  });

  test("refuses source_response from the ordinary composer", async () => {
    const { user, claimId } = await setup();
    await expect(
      user.mutation(api.comments.add, {
        annotationId: claimId,
        text: "Actually, what I meant was…",
        intent: "source_response",
      }),
    ).rejects.toThrow(/right of reply/i);
  });
});

describe("attaching a receipt", () => {
  test("carries another clip, joined so the thread can play it", async () => {
    const { t, user, userId, claimId } = await setup();
    const evidenceId = await seedClip(t, userId, { takeText: "The layoffs." });
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Here's what followed.",
      intent: "support",
      evidenceAnnotationId: evidenceId,
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.evidence).toMatchObject({
      kind: "annotation",
      annotationId: evidenceId,
      sourceTitle: "All-In E58",
      removed: false,
    });
  });

  test("carries an external link", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "The Fed minutes say otherwise.",
      intent: "challenge",
      evidenceUrl: "https://federalreserve.gov/minutes",
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.evidence).toMatchObject({
      kind: "url",
      url: "https://federalreserve.gov/minutes",
    });
  });

  test("marks a challenge with no receipt as unsourced rather than blocking it", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "I don't buy it.",
      intent: "challenge",
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.unsourced).toBe(true);
    expect(reply.evidence).toBeNull();
  });

  test("a plain comment is not labelled unsourced — it never claimed a source", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Nice clip.",
      intent: "context",
    });
    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.unsourced).toBe(false);
  });
});

describe("what a receipt is not allowed to be", () => {
  test("rejects a removed clip — removal must not be undone by citation", async () => {
    const { t, user, userId, claimId } = await setup();
    const evidenceId = await seedClip(t, userId);
    await user.mutation(api.annotations.remove, { annotationId: evidenceId });
    await expect(
      user.mutation(api.comments.add, {
        annotationId: claimId,
        text: "See this.",
        intent: "support",
        evidenceAnnotationId: evidenceId,
      }),
    ).rejects.toThrow(/no longer available/i);
  });

  test("rejects a private clip", async () => {
    const { t, user, userId, claimId } = await setup();
    const evidenceId = await seedClip(t, userId, { isPublic: false });
    await expect(
      user.mutation(api.comments.add, {
        annotationId: claimId,
        text: "See this.",
        intent: "support",
        evidenceAnnotationId: evidenceId,
      }),
    ).rejects.toThrow(/no longer available/i);
  });

  test("rejects a clip citing itself", async () => {
    const { user, claimId } = await setup();
    await expect(
      user.mutation(api.comments.add, {
        annotationId: claimId,
        text: "As I said.",
        intent: "support",
        evidenceAnnotationId: claimId,
      }),
    ).rejects.toThrow(/cite itself/i);
  });

  test("rejects a non-http(s) link", async () => {
    const { user, claimId } = await setup();
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "not a url"]) {
      await expect(
        user.mutation(api.comments.add, {
          annotationId: claimId,
          text: "Source.",
          intent: "challenge",
          evidenceUrl: url,
        }),
      ).rejects.toThrow(/web link/i);
    }
  });

  test("rejects two receipts at once — a reply carries at most one", async () => {
    const { t, user, userId, claimId } = await setup();
    const evidenceId = await seedClip(t, userId);
    await expect(
      user.mutation(api.comments.add, {
        annotationId: claimId,
        text: "Both.",
        intent: "support",
        evidenceAnnotationId: evidenceId,
        evidenceUrl: "https://example.com",
      }),
    ).rejects.toThrow(/one receipt/i);
  });
});

describe("a receipt whose clip is removed afterwards", () => {
  test("degrades to a notice instead of leaking the removed take", async () => {
    const { t, user, userId, claimId } = await setup();
    const evidenceId = await seedClip(t, userId, { takeText: "Secret take." });
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Here's what followed.",
      intent: "support",
      evidenceAnnotationId: evidenceId,
    });
    await user.mutation(api.annotations.remove, { annotationId: evidenceId });

    const [reply] = await t.query(api.comments.listByAnnotation, {
      annotationId: claimId,
    });
    expect(reply.evidence).toMatchObject({ kind: "annotation", removed: true });
    expect(JSON.stringify(reply.evidence)).not.toContain("Secret take");
  });
});

describe("the right of reply", () => {
  test("stays hidden until someone challenges the clip", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "Good clip.",
      intent: "context",
    });
    expect(
      await t.query(api.comments.rightOfReply, { annotationId: claimId }),
    ).toMatchObject({ show: false });
  });

  test("appears once a challenge exists", async () => {
    const { t, user, claimId } = await setup();
    await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "This is misleading.",
      intent: "challenge",
    });
    expect(
      await t.query(api.comments.rightOfReply, { annotationId: claimId }),
    ).toMatchObject({ show: true, response: null, sourceTitle: "All-In E58" });
  });

  test("disappears again if the only challenge is deleted", async () => {
    const { t, user, claimId } = await setup();
    const commentId = await user.mutation(api.comments.add, {
      annotationId: claimId,
      text: "This is misleading.",
      intent: "challenge",
    });
    await user.mutation(api.comments.remove, { commentId });
    expect(
      await t.query(api.comments.rightOfReply, { annotationId: claimId }),
    ).toMatchObject({ show: false });
  });
});
