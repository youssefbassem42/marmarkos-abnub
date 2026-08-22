import type { RegisteredUser } from "./api";

const ACCESS_TOKEN_KEY = "marmarkos.access_token";
const USER_KEY = "marmarkos.user";

export interface AuthSession {
  accessToken: string;
  user: RegisteredUser;
}

export function saveAuth(session: AuthSession, remember: boolean): void {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  storage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ??
    sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

export function getAuthUser(): RegisteredUser | null {
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
  const storage =
    localStorage.getItem(ACCESS_TOKEN_KEY) !== null
      ? localStorage
      : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
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
