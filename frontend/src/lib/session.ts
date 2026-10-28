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

import { getMe, isDefinitiveAuthFailure, refreshAccessToken } from "./api";
import {
  clearAuth,
  getAccessToken,
  getAuthPersistence,
  purgePersistedSession,
  saveAuth,
} from "./auth";

/**
 * The start-up restore must never hold the app hostage.
 *
 * It was 5 seconds, and a cold start (a serverless function that has to
 * wake up, a database that has to reconnect) can take longer: the
 * restore then failed and the member was logged out at the door.
 */
const RESTORE_TIMEOUT_MS = 15_000;

/** The wait between the two attempts of the restore. */
const RESTORE_RETRY_DELAY_MS = 1_500;

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

/**
 * True when the failure is definitive: the cookie is gone, the session
 * was revoked, the account is not usable any more.
 *
 * A network error, a timeout or a 5xx are not: the session is still
 * valid, the network is not.
 */
const isDefinitiveFailure = isDefinitiveAuthFailure;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function doRestore(): Promise<boolean> {
  // A token in memory (a sign-in that just happened) needs no restore.
  if (getAccessToken()) return true;

  // The memory mode must not pick up a session that an earlier version
  // left in web storage.
  if (getAuthPersistence() === "memory") {
    purgePersistedSession();
  }

  let lastError: unknown;
  // Two attempts: the second one is for the cold start that took longer
  // than the first timeout.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await wait(RESTORE_RETRY_DELAY_MS);
    try {
      const accessToken = await refreshAccessToken({
        timeoutMs: RESTORE_TIMEOUT_MS,
      });
      const user = await getMe(accessToken);
      saveAuth({ accessToken, user }, false);
      return true;
    } catch (error) {
      lastError = error;
      // The server refuses the refresh: nobody is signed in. The session
      // is cleared and the member sees the login page.
      if (isDefinitiveFailure(error)) {
        clearAuth();
        return false;
      }
      // A network problem: the session may still be perfectly alive. The
      // next attempt decides; the session is never thrown away because
      // the network blinked.
    }
  }

  // Two failures that are not the server's verdict (the network is down,
  // the server is cold). The session is left alone - it is the server
  // that decides when a session ends, not the network.
  if (lastError !== undefined && isDefinitiveFailure(lastError)) {
    clearAuth();
  }
  return false;
}

export function restoreSession(): Promise<boolean> {
  restoreInFlight ??= doRestore().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}
