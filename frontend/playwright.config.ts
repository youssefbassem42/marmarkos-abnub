import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end tests (QA-001).
 *
 * The three golden paths of the platform are tested against the real
 * stack: the API (with the database built by the migrations), the
 * frontend and a real browser. Nothing is mocked: a journey that only
 * works with mocks is not a journey.
 *
 * The stack is started by Playwright itself:
 *
 *   - the API on 127.0.0.1:8000, with the E2E database,
 *   - the frontend on 127.0.0.1:4173 (the dev server proxies /api).
 *
 * The database is created, migrated and seeded by the global setup
 * (backend/scripts/e2e_prepare.py).
 */

const API_PORT = Number(process.env.E2E_API_PORT ?? 18010);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4173);
const API_URL = `http://127.0.0.1:${API_PORT}`;

const BACKEND = "../backend";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        ".venv/bin/uvicorn app.main:app --host 127.0.0.1 --port " + API_PORT,
      cwd: BACKEND,
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APP_ENV: "test",
        DEBUG: "true",
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          "postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_e2e",
        JWT_SECRET: "e2e-test-secret-0123456789-0123456789",
        JWT_REFRESH_SECRET: "e2e-test-refresh-0123456789-0123456789",
        MAIL_PROVIDER: "console",
        ATTENDANCE_PIN_PEPPER: "e2e-pepper-0123456789-0123456789",
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: ".",
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_DEV_API_TARGET: API_URL,
      },
    },
  ],
});
