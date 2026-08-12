import { defineConfig } from "vitest/config";

// Component tests render into a DOM, unlike the backend's edge-runtime suite.
export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
