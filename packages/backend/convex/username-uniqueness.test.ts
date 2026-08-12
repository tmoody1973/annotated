import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

test("ensureCurrentUser assigns distinct usernames when display names derive the same slug", async () => {
  const t = convexTest(schema, modules);
  const first = t.withIdentity({ subject: "clerk_tarik_1", name: "Tarik Moody" });
  const second = t.withIdentity({ subject: "clerk_tarik_2", name: "Tarik Moody" });

  const firstId = await first.mutation(api.users.ensureCurrentUser, {});
  const secondId = await second.mutation(api.users.ensureCurrentUser, {});

  const firstUser = await t.run((ctx) => ctx.db.get(firstId));
  const secondUser = await t.run((ctx) => ctx.db.get(secondId));

  expect(firstUser?.username).toBe("tarik-moody");
  expect(secondUser?.username).toBe("tarik-moody-2");
  expect(firstUser?.username).not.toBe(secondUser?.username);
});
