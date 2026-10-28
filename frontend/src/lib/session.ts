/**
 * Restoring the session at start-up (SEC-004).
 *
 * With the memory persistence the access token is gone after a reload -
 * that is the point: a token in web storage is readable by every script
 * of the origin. The HttpOnly refresh cookie is still there, so the
 * session comes back with one refresh call and one profile call before
 * the router renders.
 *
 * A failure here means "nobody is signed in", which is a normal state
 * and not an error the user has to read about.
 */

import { apiClient, getMe } from "./api";
import type { TokenResponse } from "./api";
import {
  clearAuth,
  getAccessToken,
  getAuthPersistence,
  purgePersistedSession,
  saveAuth,
} from "./auth";

/** The start-up restore must never hold the app hostage. */
const RESTORE_TIMEOUT_MS = 5000;

/**
 * One restore at a time.
 *
 * The refresh token is **rotated**: the backend hands out a new one and
 * revokes the old. Two parallel restores therefore send the same (now
 * revoked) token twice: the second answer is a 401, and the session is
 * cleared - the member is logged out by a reload.
 *
 * React mounts the providers twice in the development (StrictMode), and
 * any remount of the shell does it again. The callers share one promise
 * instead, exactly like the silent refresh of the interceptor does.
 */
let restoreInFlight: Promise<boolean> | null = null;

async function doRestore(): Promise<boolean> {
  // A token in memory (a sign-in that just happened) needs no restore.
  if (getAccessToken()) return true;

  // The memory mode must not pick up a session that an earlier version
  // left in web storage.
  if (getAuthPersistence() === "memory") {
    purgePersistedSession();
  }

  try {
    const { data } = await apiClient.post<TokenResponse>(
      "/auth/refresh",
      undefined,
      { timeout: RESTORE_TIMEOUT_MS },
    );
    const user = await getMe(data.access_token);
    saveAuth({ accessToken: data.access_token, user }, false);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

export function restoreSession(): Promise<boolean> {
  restoreInFlight ??= doRestore().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}
