import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * The API of the browser is always the same origin (SEC-004 / the cookie).
 *
 * The refresh cookie is HttpOnly and SameSite=Lax: a call to a second
 * origin drops it and the session dies after 30 minutes with no way to
 * recover. The base URL must therefore be relative by default - the
 * absolute "http://localhost:8000/api/v1" made the browser of the member
 * call its own machine (the Docker image and a fresh clone were broken).
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

  it("still accepts an absolute URL when one is asked for", async () => {
    const baseURL = await loadBaseUrl({
      VITE_API_BASE_URL: "https://api.example.com/api/v1",
    });
    expect(baseURL).toBe("https://api.example.com/api/v1");
  });

  it("completes a bare path with the version of the API", async () => {
    const baseURL = await loadBaseUrl({ VITE_API_BASE_URL: "/backend" });
    expect(baseURL).toBe("/backend/api/v1");
  });
});
