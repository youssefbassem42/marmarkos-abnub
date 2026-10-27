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
        // The shadcn/ui primitives are vendored (components.json is the
        // receipt): they are copied from the upstream project, not
        // written by this team. Measuring them says nothing about the
        // code of the platform - and they are replaced wholesale when
        // the upstream changes.
        "src/components/ui/**",
      ],
      reporter: ["text", "json-summary"],
      // The floors are the current measured values (27.51 % statements,
      // 15.80 % branches, 32.62 % functions, 28.33 % lines). They may
      // only ever be raised - never lowered (CI-005).
      //
      // Phase 5.4 brought the logic of the frontend to a good level:
      // the API clients are at 99 %, the hooks at 64 %, the shared
      // library at 70 %. What is left is the markup of the 30 pages
      // (1506 statements, 5.6 %): covering every page is a project of
      // its own (one render test per screen), not a remediation. The
      // floor is therefore the measured value, and it only goes up.
      thresholds: {
        statements: 27,
        branches: 15,
        functions: 32,
        lines: 28,
      },
    },
  },
});
