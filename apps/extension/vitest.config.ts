import { defineConfig } from "vitest/config";

/**
 * Unit tests for the panel's pure logic. The extension's other tests are
 * Playwright `.e2e.mjs` scripts that load an unpacked build; those are run
 * directly with node and are excluded here.
 */
export default defineConfig({
  test: {
    environment: "node",
    // `.ts` only, deliberately. Plasmo's tsconfig sets `jsx: "preserve"`, which
    // vite's transform refuses, so a screen's testable logic (span seeding,
    // dead-end copy) lives in a plain module beside its JSX rather than inside it.
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
