import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");
const WORKER_TOKEN = "test-worker-token";

beforeAll(() => {
  process.env.WORKER_AUTH_TOKEN = WORKER_TOKEN;
});

async function seedPodcastSource(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: `test://ep/${Date.now()}`,
      title: "Long Episode",
    })
  );
}

test("a >8192-word transcript round-trips as a JSON string (no array-cap error)", async () => {
  const t = convexTest(schema, modules);
  const sourceId = await seedPodcastSource(t);

  const transcriptId = await t.mutation(api.transcripts.create, {
    sourceId,
    provider: "deepgram",
    workerToken: WORKER_TOKEN,
  });

  // 11,000 words — well past Convex's 8192 array limit, which is exactly what
  // broke the NPR episode. As a JSON string this must pass.
  const words = Array.from({ length: 11_000 }, (_, i) => ({
    word: `w${i}`,
    startMs: i * 100,
    endMs: i * 100 + 90,
    speaker: "0",
  }));

  await t.mutation(api.transcripts.setReady, {
    transcriptId,
    wordsJson: JSON.stringify(words),
    workerToken: WORKER_TOKEN,
  });

  const row = await t.query(api.transcripts.getBySource, { sourceId });
  expect(row?.status).toBe("ready");
  expect(row?.wordsJson).toBeTruthy();

  const parsed = JSON.parse(row!.wordsJson!) as typeof words;
  expect(parsed).toHaveLength(11_000);
  expect(parsed[0]?.word).toBe("w0");
  expect(parsed[10_999]?.word).toBe("w10999");
});

test("setReady rejects a bad worker token", async () => {
  const t = convexTest(schema, modules);
  const sourceId = await seedPodcastSource(t);
  const transcriptId = await t.mutation(api.transcripts.create, {
    sourceId,
    provider: "deepgram",
    workerToken: WORKER_TOKEN,
  });

  await expect(
    t.mutation(api.transcripts.setReady, {
      transcriptId,
      wordsJson: "[]",
      workerToken: "wrong",
    })
  ).rejects.toThrow(/Unauthorized/);
});
