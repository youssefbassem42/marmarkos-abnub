/**
 * Silent-refresh behaviour of the shared axios client.
 *
 * Regression guard for the production symptom "every endpoint returns 401 but
 * the UI still looks signed in": the access token expires after 30 minutes and
 * nothing renewed it, because there was no 401 handling at all.
 */

import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import { clearAuth, getAccessToken, saveAuth } from "@/lib/auth";
import type { RegisteredUser } from "@/lib/api";

const USER = {
  id: "u-1",
  email: "member@example.com",
  role: "MEMBER",
} as RegisteredUser;

const originalAdapter = apiClient.defaults.adapter;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  } as AxiosResponse;
}

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  const response = {
    data: { detail: { code: "unauthorized", message: "Not authenticated" } },
    status: 401,
    statusText: "Unauthorized",
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError("Unauthorized", "401", config, undefined, response);
}

interface Recorded {
  url: string;
  authorization?: string;
}

/** Install an adapter that 401s protected calls until the token is refreshed. */
function installAdapter(options: { refreshSucceeds: boolean }): Recorded[] {
  const calls: Recorded[] = [];
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    calls.push({
      url,
      authorization: config.headers.Authorization as string | undefined,
    });

    if (url === "/auth/refresh") {
      if (!options.refreshSucceeds) throw unauthorized(config);
      return ok(config, {
        access_token: "fresh-token",
        token_type: "bearer",
        expires_in: 1800,
      });
    }

    if (config.headers.Authorization === "Bearer fresh-token") {
      return ok(config, { unread_count: 3 });
    }
    throw unauthorized(config);
  };
  return calls;
}

describe("apiClient silent refresh", () => {
  beforeEach(() => {
    clearAuth();
    saveAuth({ accessToken: "stale-token", user: USER }, true);
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    clearAuth();
    vi.restoreAllMocks();
  });

  it("refreshes once and retries the original request", async () => {
    const calls = installAdapter({ refreshSucceeds: true });

    const response = await apiClient.get("/notifications/summary");

    expect(response.data).toEqual({ unread_count: 3 });
    expect(calls.map((call) => call.url)).toEqual([
      "/notifications/summary",
      "/auth/refresh",
      "/notifications/summary",
    ]);
    // The retry must carry the new token, not the expired one it was built with.
    expect(calls[2].authorization).toBe("Bearer fresh-token");
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("refreshes only once for a burst of parallel 401s", async () => {
    const calls = installAdapter({ refreshSucceeds: true });

    await Promise.all([
      apiClient.get("/notifications/summary"),
      apiClient.get("/notifications"),
      apiClient.get("/users/me"),
    ]);

    expect(calls.filter((call) => call.url === "/auth/refresh")).toHaveLength(
      1,
    );
  });

  it("clears the session when the refresh cookie is gone", async () => {
    installAdapter({ refreshSucceeds: false });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/notifications", assign },
    });

    await expect(apiClient.get("/notifications/summary")).rejects.toMatchObject(
      {
        status: 401,
      },
    );

    expect(getAccessToken()).toBeNull();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does not attempt a refresh for a signed-out caller", async () => {
    clearAuth();
    const calls = installAdapter({ refreshSucceeds: true });

    await expect(apiClient.get("/notifications/summary")).rejects.toMatchObject(
      {
        status: 401,
      },
    );

    expect(calls.map((call) => call.url)).toEqual(["/notifications/summary"]);
  });

  it("never recurses through a failed login", async () => {
    const calls = installAdapter({ refreshSucceeds: true });

    await expect(
      apiClient.post("/auth/login", { email: "a@b.c", password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });

    expect(calls.map((call) => call.url)).toEqual(["/auth/login"]);
  });
});
