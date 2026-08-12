import { defineConfig } from "vitest/config";

/**
 * Unit tests for the panel's pure logic. The extension's other tests are
 * Playwright `.e2e.mjs` scripts that load an unpacked build; those are run
 * directly with node and are excluded here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
