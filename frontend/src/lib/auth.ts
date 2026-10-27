import type { RegisteredUser } from "./api";

const ACCESS_TOKEN_KEY = "marmarkos.access_token";
const USER_KEY = "marmarkos.user";

/**
 * Where the access token is kept (SEC-004).
 *
 * - `memory`  - only in the JavaScript memory of the page. A script that
 *   runs on the page (an XSS payload) can still read it, but a script that
 *   only has access to the storage of another origin cannot. The token
 *   dies with the tab; the session is restored on start-up from the
 *   HttpOnly refresh cookie.
 * - `session` - sessionStorage: survives a reload of the same tab.
 * - `local`   - localStorage: the behaviour before this change; the token
 *   is readable by any script on the origin until it expires.
 *
 * The mode is read from `VITE_AUTH_PERSISTENCE`. The rollback is one
 * environment variable: `VITE_AUTH_PERSISTENCE=local` restores the old
 * behaviour without a code change.
 */
export type AuthPersistence = "memory" | "session" | "local";

export function getAuthPersistence(): AuthPersistence {
  const raw = String(import.meta.env.VITE_AUTH_PERSISTENCE ?? "memory")
    .trim()
    .toLowerCase();
  if (raw === "session" || raw === "local") {
    return raw;
  }
  return "memory";
}

export interface AuthSession {
  accessToken: string;
  user: RegisteredUser;
}

/**
 * The primary store: the memory of the page.
 *
 * The access token is a bearer credential - whoever holds it *is* the
 * member. Web storage (localStorage/sessionStorage) is readable by every
 * script of the origin, so the token is kept out of it by default.
 */
let memoryAccessToken: string | null = null;
let memoryUser: RegisteredUser | null = null;

/** The storage that holds the session in the current mode (null = memory). */
function storageFor(remember: boolean): Storage | null {
  const mode = getAuthPersistence();
  if (mode === "memory") return null;
  if (mode === "session") return sessionStorage;
  return remember ? localStorage : sessionStorage;
}

export function saveAuth(session: AuthSession, remember: boolean): void {
  memoryAccessToken = session.accessToken;
  memoryUser = session.user;

  const storage = storageFor(remember);
  if (!storage) return;
  storage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  storage.setItem(USER_KEY, JSON.stringify(session.user));
}

/** Remove a session that an earlier version left in web storage. */
export function purgePersistedSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  memoryAccessToken = null;
  memoryUser = null;
  purgePersistedSession();
}

export function getAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  // In the memory mode the web storage is never read: a token left there
  // by an earlier version must not silently come back to life.
  if (getAuthPersistence() === "memory") return null;
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ??
    sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

export function getAuthUser(): RegisteredUser | null {
  if (memoryUser) return memoryUser;
  if (getAuthPersistence() === "memory") return null;
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RegisteredUser;
  } catch {
    return null;
  }
}

/** Overwrite the stored user object after a profile change. */
export function updateStoredUser(user: RegisteredUser): void {
  memoryUser = user;
  const storage =
    localStorage.getItem(ACCESS_TOKEN_KEY) !== null
      ? localStorage
      : sessionStorage;
  if (getAuthPersistence() === "memory") return;
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateAccessToken(accessToken: string): void {
  memoryAccessToken = accessToken;
  if (getAuthPersistence() === "memory") return;
  const storage =
    localStorage.getItem(ACCESS_TOKEN_KEY) !== null
      ? localStorage
      : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export type UserRole = "ADMIN" | "SERVANT" | "MEMBER";

/** The stored user's role, or null when signed out / unknown. */
export function getUserRole(): UserRole | null {
  const user = getAuthUser();
  if (!user) return null;
  return user.role === "ADMIN" ||
    user.role === "SERVANT" ||
    user.role === "MEMBER"
    ? user.role
    : null;
}

/** True when the signed-in user holds any of the given roles. */
export function hasAnyRole(...roles: UserRole[]): boolean {
  const role = getUserRole();
  return role !== null && roles.includes(role);
}

/** Attendance management is ADMIN + SERVANT only (BR-7). */
export function isAttendanceManager(): boolean {
  return hasAnyRole("ADMIN", "SERVANT");
}
