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
    // The unit tests live in src/; the end-to-end tests live in e2e/
    // and are driven by Playwright (QA-001), not by vitest. Without this
    // line vitest picks the Playwright specs up and fails on them.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
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
      // The floors are the measured values (71.97 % statements, 60.87 %
      // branches, 65.46 % functions, 73.97 % lines). They may only ever
      // be raised - never lowered (CI-005).
      //
      // Phase 5.4 brought the logic of the frontend to a good level:
      // the API clients are at 99 %, the hooks at 64 %, the shared
      // library at 70 %. The second half of the phase rendered the
      // **pages** themselves (the entrance, the profile, the quiz, the
      // attendance, the analytics): the floor went from 27 % to 47 %.
      //
      // What is left is the markup of the ~30 pages that are still
      // unrendered (the administration of the verses and of the
      // quizzes): covering them is one render test per screen, and the
      // floor goes up with every one of them.
      thresholds: {
        statements: 71,
        branches: 60,
        functions: 65,
        lines: 73,
      },
    },
  },
});
