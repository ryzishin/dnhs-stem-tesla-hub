// vitest.config.js — v3-P1-6
// Vitest config for the smoke test suite. Picks up `src/tests/**/*.test.js`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.js"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
