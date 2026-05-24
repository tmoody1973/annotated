import { defineConfig } from "vitest/config";

// convex-test runs Convex functions in an edge-runtime VM against an in-memory
// database, so auth-derived mutations can be exercised with a mocked identity.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
