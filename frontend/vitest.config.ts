import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    css: false,
    coverage: {
      // The whole source tree is measured - a coverage number that only
      // counts the files a test happens to import says nothing about the
      // files nobody tests.
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/test/**",
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
      ],
      reporter: ["text", "json-summary"],
      // The floors are the current measured values (17.97 % statements,
      // 12.07 % branches, 14.21 % functions, 18.28 % lines). They may
      // only ever be raised - never lowered (CI-005). Phase 5.4 brings
      // them to 70 %.
      thresholds: {
        statements: 17,
        branches: 12,
        functions: 14,
        lines: 18,
      },
    },
  },
});
