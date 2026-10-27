/**
 * The access-token persistence (SEC-004).
 *
 * The access token is a bearer credential: whoever holds it *is* the
 * member. The default keeps it in the memory of the page, so no script
 * outside the origin can read it; the two other modes exist as the
 * documented rollback (`local`) and as a middle ground (`session`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuth,
  getAccessToken,
  getAuthPersistence,
  getAuthUser,
  saveAuth,
  updateAccessToken,
} from "../auth";
import type { RegisteredUser } from "../api";

const TOKEN_KEY = "marmarkos.access_token";
const USER_KEY = "marmarkos.user";

const USER = {
  id: "u-1",
  email: "member@example.com",
  role: "MEMBER",
} as RegisteredUser;

function setMode(mode: string | undefined): void {
  // The mode is read from import.meta.env at call time.
  vi.stubEnv("VITE_AUTH_PERSISTENCE", mode ?? "");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearAuth();
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearAuth();
});

describe("the token persistence", () => {
  it("defaults to the memory", () => {
    setMode(undefined);
    expect(getAuthPersistence()).toBe("memory");
  });

  it("keeps the token out of web storage in the memory mode", () => {
    setMode("memory");

    saveAuth({ accessToken: "token-1", user: USER }, true);

    expect(getAccessToken()).toBe("token-1");
    expect(getAuthUser()).toEqual(USER);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_KEY)).toBeNull();
  });

  it("never reads a token that an earlier version left in web storage", () => {
    setMode("memory");
    localStorage.setItem(TOKEN_KEY, "stale-token");

    expect(getAccessToken()).toBeNull();
  });

  it("writes to sessionStorage in the session mode", () => {
    setMode("session");

    saveAuth({ accessToken: "token-2", user: USER }, true);

    expect(sessionStorage.getItem(TOKEN_KEY)).toBe("token-2");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(getAccessToken()).toBe("token-2");
  });

  it("writes to localStorage in the local mode when the member asked to be remembered", () => {
    setMode("local");

    saveAuth({ accessToken: "token-3", user: USER }, true);

    expect(localStorage.getItem(TOKEN_KEY)).toBe("token-3");
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(getAccessToken()).toBe("token-3");
  });

  it("keeps the session mode of the local storage when the member did not ask to be remembered", () => {
    setMode("local");

    saveAuth({ accessToken: "token-4", user: USER }, false);

    expect(sessionStorage.getItem(TOKEN_KEY)).toBe("token-4");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("falls back to the memory for an unknown mode", () => {
    setMode("nonsense");
    expect(getAuthPersistence()).toBe("memory");
  });

  it("removes the session everywhere when it is cleared", () => {
    setMode("local");
    saveAuth({ accessToken: "token-5", user: USER }, true);

    clearAuth();

    expect(getAccessToken()).toBeNull();
    expect(getAuthUser()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("keeps the refreshed token in memory in the memory mode", () => {
    setMode("memory");
    saveAuth({ accessToken: "old", user: USER }, false);

    updateAccessToken("new");

    expect(getAccessToken()).toBe("new");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
