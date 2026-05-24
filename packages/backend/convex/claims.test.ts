import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

type TestCtx = ReturnType<typeof convexTest>;

async function seedAnnotation(t: TestCtx): Promise<Id<"annotations">> {
  return await t.run(async (ctx) => {
    const authorId = await ctx.db.insert("users", {
      clerkId: "clerk_author",
      username: "author",
      displayName: "Author",
    });
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/post",
      title: "Test Article",
    });
    return await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      selectedText: "quote",
      commentaryText: "take",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });
}

const validClaim = {
  claimantName: "Jane Rights",
  claimantEmail: "jane@label.com",
  reason: "This clip uses my copyrighted audio without permission.",
};

test("public claim submission persists an open claim and validates input", async () => {
  const t = convexTest(schema, modules);
  const annotationId = await seedAnnotation(t);

  // Valid submit, unauthenticated, with padded fields → row lands "open", trimmed.
  const claimId = await t.mutation(api.claims.submit, {
    annotationId,
    ...validClaim,
    claimantName: "  Jane Rights  ",
  });
  const row = await t.run((ctx) => ctx.db.get(claimId));
  expect(row?.status).toBe("open");
  expect(row?.claimantName).toBe("Jane Rights"); // trimmed
  expect(row?.annotationId).toBe(annotationId);
  expect(row?.submittedAt).toBeTypeOf("number");

  // listOpen (internal — manual review) surfaces it; it is not client-callable.
  const open = await t.query(internal.claims.listOpen, {});
  expect(open.some((c) => c._id === claimId)).toBe(true);

  // Empty name rejected.
  await expect(
    t.mutation(api.claims.submit, { annotationId, ...validClaim, claimantName: "   " })
  ).rejects.toThrow();

  // Malformed email rejected.
  await expect(
    t.mutation(api.claims.submit, { annotationId, ...validClaim, claimantEmail: "not-an-email" })
  ).rejects.toThrow();

  // Empty reason rejected.
  await expect(
    t.mutation(api.claims.submit, { annotationId, ...validClaim, reason: "   " })
  ).rejects.toThrow();

  // Over-length name rejected.
  await expect(
    t.mutation(api.claims.submit, { annotationId, ...validClaim, claimantName: "x".repeat(201) })
  ).rejects.toThrow();

  // Over-length reason rejected.
  await expect(
    t.mutation(api.claims.submit, { annotationId, ...validClaim, reason: "x".repeat(5001) })
  ).rejects.toThrow();

  // Control characters in the name (header-injection vector) rejected.
  await expect(
    t.mutation(api.claims.submit, {
      annotationId,
      ...validClaim,
      claimantName: "Jane\nBcc: evil@example.com",
    })
  ).rejects.toThrow();

  // Non-existent (but well-formed) annotation id rejected.
  const danglingId = await t.run(async (ctx) => {
    const authorId = (await ctx.db.query("users").first())!._id;
    const sourceId = (await ctx.db.query("sources").first())!._id;
    const id = await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      isPublic: true,
      commentCount: 0,
      likeCount: 0,
    });
    await ctx.db.delete(id);
    return id;
  });
  await expect(
    t.mutation(api.claims.submit, { annotationId: danglingId, ...validClaim })
  ).rejects.toThrow();
});
