import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * The API of the browser is always the same origin (SEC-004 / the cookie).
 *
 * The refresh cookie is HttpOnly: on another site it is a third-party
 * cookie, the browser blocks it, and the session dies at every reload -
 * the member has to sign in again and again. The base URL must therefore
 * be relative, and an absolute URL is **ignored** whatever the
 * environment says: the session of the member matters more than the
 * address of the API.
 */

async function loadBaseUrl(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value as string);
  }
  const api = await import("@/lib/api");
  return api.apiClient.defaults.baseURL;
}

describe("the base URL of the API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is the relative path when nothing is configured", async () => {
    const baseURL = await loadBaseUrl({ VITE_API_BASE_URL: undefined });
    expect(baseURL).toBe("/api/v1");
  });

  it("never points at localhost by default", async () => {
    const baseURL = await loadBaseUrl({ VITE_API_BASE_URL: undefined });
    expect(String(baseURL)).not.toContain("localhost");
    expect(String(baseURL)).not.toContain("127.0.0.1");
  });

  it("keeps the relative path that is configured", async () => {
    const baseURL = await loadBaseUrl({ VITE_API_BASE_URL: "/api/v1" });
    expect(baseURL).toBe("/api/v1");
  });

  it("ignores an absolute URL: the session cookie would not survive", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const baseURL = await loadBaseUrl({
      VITE_API_BASE_URL: "https://api.example.com/api/v1",
    });

    expect(baseURL).toBe("/api/v1");
    // The reason is never a mystery: it is written in the console.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores an absolute URL without its scheme too", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const baseURL = await loadBaseUrl({
      VITE_API_BASE_URL: "marmarkos-abnub-ny1l.vercel.app/api/v1",
    });

    expect(baseURL).toBe("/api/v1");
    vi.restoreAllMocks();
  });

  it("completes a bare path with the version of the API", async () => {
    const baseURL = await loadBaseUrl({ VITE_API_BASE_URL: "/backend" });
    expect(baseURL).toBe("/backend/api/v1");
  });
});
