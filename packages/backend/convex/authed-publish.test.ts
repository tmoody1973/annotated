import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

/** A throwaway storage blob so the clip-bearing mutation has a real storageId. */
async function seedClipStorage(
  t: ReturnType<typeof convexTest>
): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["clip"])));
}

test("createYoutube attributes the clip to the signed-in Clerk identity", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  const tarikId = await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);

  const annotationId = await tarik.mutation(api.annotations.createYoutube, {
    videoId: "dQw4w9WgXcQ",
    title: "A video",
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    commentaryText: "my take",
  });

  const stored = await t.run((ctx) => ctx.db.get(annotationId));
  expect(stored?.authorId).toBe(tarikId);
  expect(stored?.isPublic).toBe(true);
});

test("createYoutube rejects an unauthenticated caller", async () => {
  const t = convexTest(schema, modules);
  const clipStorageId = await seedClipStorage(t);

  await expect(
    t.mutation(api.annotations.createYoutube, {
      videoId: "dQw4w9WgXcQ",
      title: "A video",
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      commentaryText: "my take",
    })
  ).rejects.toThrow("Not authenticated");
});

test("createYoutube accepts audio commentary, anonymity, and a thread", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const audioStorageId = await seedClipStorage(t);

  // Anonymous audio-only clip (no commentaryText) must publish.
  const annotationId = await tarik.mutation(api.annotations.createYoutube, {
    videoId: "abc123",
    title: "Another video",
    clipStorageId,
    clipStartMs: 1_000,
    clipEndMs: 5_000,
    commentaryAudioStorageId: audioStorageId,
    commentaryAudioTranscript: "spoken take",
    isAnonymous: true,
  });

  const stored = await t.run((ctx) => ctx.db.get(annotationId));
  expect(stored?.isAnonymous).toBe(true);
  expect(stored?.commentaryAudioStorageId).toBe(audioStorageId);
});

test("createYoutube refuses to append to a thread the caller does not own", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "clerk_alice", name: "Alice" });
  const bob = t.withIdentity({ subject: "clerk_bob", name: "Bob" });
  const aliceId = await alice.mutation(api.users.ensureCurrentUser, {});
  await bob.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);

  // A thread owned by Alice.
  const aliceThreadId = await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: "https://youtu.be/x",
      title: "Vid",
    });
    return await ctx.db.insert("threads", {
      authorId: aliceId,
      sourceId,
      createdAt: Date.now(),
    });
  });

  // Bob cannot append his clip to Alice's thread.
  await expect(
    bob.mutation(api.annotations.createYoutube, {
      videoId: "x",
      title: "Vid",
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      commentaryText: "sneaky",
      threadId: aliceThreadId,
    })
  ).rejects.toThrow("thread you do not own");

  // Alice can append to her own thread.
  const ok = await alice.mutation(api.annotations.createYoutube, {
    videoId: "x",
    title: "Vid",
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    commentaryText: "mine",
    threadId: aliceThreadId,
  });
  expect(ok).toBeTruthy();
});

test("createYoutube rejects a clip with no commentary at all", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);

  await expect(
    tarik.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "A video",
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
    })
  ).rejects.toThrow("Commentary is required");
});
