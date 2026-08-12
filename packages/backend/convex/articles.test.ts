import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("extractArticle guards", () => {
  test("rejects a signed-out caller before touching storage", async () => {
    const t = convexTest(schema, modules);
    const htmlStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["<html></html>"], { type: "text/html" }))
    );

    await expect(
      t.action(api.articles.extractArticle, {
        url: "https://example.com/article",
        htmlStorageId,
      })
    ).rejects.toThrow(/Sign in/);

    // The unauthenticated call must never reach the storage.delete() in the
    // handler's finally block — an attacker could otherwise delete any blob
    // (clips, screenshots, take audio) by guessing/reusing a valid _storage id.
    const stillStored = await t.run(async (ctx) =>
      ctx.db.system.get("_storage", htmlStorageId)
    );
    expect(stillStored).not.toBeNull();
  });
});
