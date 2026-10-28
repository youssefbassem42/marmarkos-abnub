/**
 * The start-up restore of the session (SEC-004).
 *
 * With the memory persistence a reload leaves the page without an access
 * token; the HttpOnly refresh cookie is still there, so the session has
 * to come back before the router renders - otherwise the route guard
 * would send a signed-in member to the login page on every reload.
 */

import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import { clearAuth, getAccessToken } from "@/lib/auth";
import { restoreSession } from "@/lib/session";
import type { RegisteredUser } from "@/lib/api";

const USER = {
  id: "u-1",
  email: "member@example.com",
  role: "MEMBER",
} as RegisteredUser;

const originalAdapter = apiClient.defaults.adapter;
const calls: string[] = [];

function installAdapter(options: {
  refreshFails?: boolean;
  /** The refresh fails with a transient failure (the network blinked). */
  refreshIsTransient?: boolean;
  /** The first attempt fails, the second one works. */
  firstAttemptFails?: boolean;
}): void {
  calls.length = 0;
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? "";
    calls.push(url);

    if (url === "/auth/refresh") {
      if (
        options.firstAttemptFails &&
        calls.filter((c) => c === url).length === 1
      ) {
        const response = {
          data: { detail: "Service unavailable" },
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          config,
        } as AxiosResponse;
        throw new AxiosError(
          "Service Unavailable",
          "503",
          config,
          undefined,
          response,
        );
      }
      if (options.refreshIsTransient) {
        const response = {
          data: { detail: "Service unavailable" },
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          config,
        } as AxiosResponse;
        throw new AxiosError(
          "Service Unavailable",
          "503",
          config,
          undefined,
          response,
        );
      }
      if (options.refreshFails) {
        // A custom adapter bypasses axios' own status validation, so the
        // failure is raised the way the http adapter raises it.
        const response = {
          data: {
            detail: { code: "unauthorized", message: "Not authenticated" },
          },
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
        } as AxiosResponse;
        throw new AxiosError(
          "Unauthorized",
          "401",
          config,
          undefined,
          response,
        );
      }
      return {
        data: {
          access_token: "fresh-token",
          token_type: "bearer",
          expires_in: 1800,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    }

    if (url === "/users/me") {
      return {
        data: USER,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    }

    return {
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as AxiosResponse;
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_AUTH_PERSISTENCE", "memory");
  localStorage.clear();
  sessionStorage.clear();
  clearAuth();
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
  clearAuth();
});

describe("restoreSession", () => {
  it("restores the session from the refresh cookie", async () => {
    installAdapter({});

    const restored = await restoreSession();

    expect(restored).toBe(true);
    expect(getAccessToken()).toBe("fresh-token");
    expect(calls).toEqual(["/auth/refresh", "/users/me"]);
  });

  it("reports a signed-out visitor without an error", async () => {
    installAdapter({ refreshFails: true });

    const restored = await restoreSession();

    expect(restored).toBe(false);
    expect(getAccessToken()).toBeNull();
    // The server refused the refresh: there is nothing to retry.
    expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(1);
  });

  it("does nothing when a token is already in memory", async () => {
    installAdapter({});

    const { saveAuth } = await import("@/lib/auth");
    saveAuth({ accessToken: "already-there", user: USER }, false);

    const restored = await restoreSession();

    expect(restored).toBe(true);
    expect(getAccessToken()).toBe("already-there");
    expect(calls).toEqual([]);
  });

  it("removes a session that an earlier version left in web storage", async () => {
    installAdapter({ refreshFails: true });
    localStorage.setItem("marmarkos.access_token", "stale");

    await restoreSession();

    expect(localStorage.getItem("marmarkos.access_token")).toBeNull();
  });

  it("refreshes once when two restores run at the same time", async () => {
    // The refresh token is rotated: a second refresh with the same (now
    // revoked) token answers 401 and the session is cleared. The E2E of
    // Phase 5.5 found exactly that - React mounts the providers twice in
    // the development and the member was logged out by a reload.
    installAdapter({});

    const [first, second] = await Promise.all([
      restoreSession(),
      restoreSession(),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(1);
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("does not throw the member out when the refresh fails transiently", async () => {
    // The network blinked (a cold start, a 5xx). The session of the
    // browser is still valid: signing the member out was the "auto
    // logout" the members reported. The restore tries a second time and
    // leaves the session alone.
    installAdapter({ refreshIsTransient: true });

    const restored = await restoreSession();

    expect(restored).toBe(false);
    // Two attempts: a cold start is worth a second try.
    expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(2);
    // The profile was never asked for (there is no token).
    expect(calls).not.toContain("/users/me");
  });

  it("tries a second time when the first attempt fails", async () => {
    installAdapter({ firstAttemptFails: true });

    const restored = await restoreSession();

    expect(restored).toBe(true);
    expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(2);
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("shares the answer of a failed restore", async () => {
    installAdapter({ refreshFails: true });

    const [first, second] = await Promise.all([
      restoreSession(),
      restoreSession(),
    ]);

    expect(first).toBe(false);
    expect(second).toBe(false);
    expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(1);
  });
});
