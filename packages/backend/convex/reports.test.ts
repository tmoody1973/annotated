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
      takeText: "take",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });
}

const validReport = {
  category: "misleading_excerpt" as const,
  details: "The clip cuts the sentence before the speaker reverses the claim.",
};

test("public report submission persists an open report and validates input", async () => {
  const t = convexTest(schema, modules);
  const annotationId = await seedAnnotation(t);

  // Valid submit, unauthenticated, no contact email — a reporter may stay anonymous.
  const reportId = await t.mutation(api.reports.submit, {
    annotationId,
    ...validReport,
    details: `  ${validReport.details}  `,
  });
  const row = await t.run((ctx) => ctx.db.get(reportId));
  expect(row?.status).toBe("open");
  expect(row?.category).toBe("misleading_excerpt");
  expect(row?.details).toBe(validReport.details); // trimmed
  expect(row?.reporterEmail).toBeUndefined();
  expect(row?.annotationId).toBe(annotationId);
  expect(row?.submittedAt).toBeTypeOf("number");

  // listOpen (internal — manual review) surfaces it; it is not client-callable.
  const open = await t.query(internal.reports.listOpen, {});
  expect(open.some((r) => r._id === reportId)).toBe(true);

  // An optional email is kept when well-formed.
  const withEmail = await t.mutation(api.reports.submit, {
    annotationId,
    ...validReport,
    reporterEmail: " watcher@example.com ",
  });
  expect(await t.run((ctx) => ctx.db.get(withEmail))).toMatchObject({
    reporterEmail: "watcher@example.com",
  });

  // Every listed category is accepted.
  for (const category of [
    "missing_context",
    "wrong_attribution",
    "harassment",
    "spam",
    "other",
  ] as const) {
    await t.mutation(api.reports.submit, { annotationId, category, details: "why" });
  }

  // Empty details rejected — a bare category is not actionable.
  await expect(
    t.mutation(api.reports.submit, { annotationId, ...validReport, details: "   " })
  ).rejects.toThrow();

  // Over-length details rejected.
  await expect(
    t.mutation(api.reports.submit, {
      annotationId,
      ...validReport,
      details: "x".repeat(5001),
    })
  ).rejects.toThrow();

  // A supplied email must be well-formed (it is the reply-to on the notification).
  await expect(
    t.mutation(api.reports.submit, {
      annotationId,
      ...validReport,
      reporterEmail: "not-an-email",
    })
  ).rejects.toThrow();

  // Control characters in the email (header-injection vector) rejected.
  await expect(
    t.mutation(api.reports.submit, {
      annotationId,
      ...validReport,
      reporterEmail: "ok@example.com\nBcc: evil@example.com",
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
    t.mutation(api.reports.submit, { annotationId: danglingId, ...validReport })
  ).rejects.toThrow();
});
