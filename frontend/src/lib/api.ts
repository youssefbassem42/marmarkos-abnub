import axios from "axios";
import { getAccessToken } from "@/lib/auth";

function resolveApiBaseUrl(): string {
  let raw = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
  // Guard against a base URL set without its scheme (axios would then treat
  // "example.com/api/v1" as a relative path on the current origin).
  if (!/^https?:\/\//i.test(raw)) {
    raw =
      raw.startsWith("localhost") || raw.startsWith("127.")
        ? `http://${raw}`
        : `https://${raw}`;
  }
  // All backend routes live under /api/v1; tolerate a bare host.
  const trimmed = raw.replace(/\/+$/, "");
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

export const apiClient = axios.create({ baseURL: resolveApiBaseUrl() });

/** Paths that must never carry the bearer token. */
const AUTH_FREE_PREFIXES = ["/auth/login", "/auth/register", "/auth/google"];

apiClient.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const authFree = AUTH_FREE_PREFIXES.some((prefix) => url.startsWith(prefix));
  const token = getAccessToken();
  if (token && !authFree && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiErrorDetail {
  status: number;
  /** Backend error code, e.g. "conflict" / "validation_error"; undefined when unknown. */
  code?: string;
  message: string;
}

/**
 * Map any axios failure to an ApiError using the shared precedence:
 * `detail` string -> `detail[].msg` -> `detail.message` -> axios message.
 * The transport returns the backend code + raw message; components decide
 * how to translate them.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error)) {
    return new ApiError(
      0,
      error instanceof Error ? error.message : "Request failed",
    );
  }

  const status = error.response?.status ?? 0;
  const detail: unknown = error.response?.data?.detail;

  let message: string | undefined;
  let code: string | undefined;

  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") message = first.msg;
  } else if (detail && typeof detail === "object") {
    const record = detail as { code?: unknown; message?: unknown };
    if (typeof record.code === "string") code = record.code;
    if (typeof record.message === "string") message = record.message;
  }

  if (!message && typeof error.message === "string" && error.message) {
    message = error.message;
  }

  return new ApiError(status, message ?? "Request failed", code);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Extract a displayable message from any API failure.
 *
 * The backend returns `{ detail: { code, message } }` for handled errors and
 * `{ detail: [{ msg }] }` for FastAPI validation errors, so `detail` must
 * never be rendered directly.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Request failed",
): string {
  const apiError = toApiError(error);
  return apiError.message || fallback;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  /** ISO date (YYYY-MM-DD) */
  date_of_birth: string;
  address: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  avatar: string | null;
  role: string;
  status: string;
  public_id: string;
  created_at: string;
  has_password: boolean;
}

/** Register a new member. Returns the created user (no tokens on register). */
export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisteredUser> {
  const { data } = await apiClient.post<RegisteredUser>(
    "/auth/register",
    payload,
  );
  return data;
}

export interface RequestPasswordResetPayload {
  email: string;
}

/**
 * Pending backend integration: the forgot-password endpoint does not exist on
 * the API yet. This is the agreed contract (POST /auth/password/forgot with
 * the email); the page connects to it automatically once the backend exposes
 * it.
 */
export async function requestPasswordReset(
  payload: RequestPasswordResetPayload,
): Promise<void> {
  await apiClient.post("/auth/password/forgot", payload);
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

/**
 * Pending backend integration: the password-reset endpoint does not exist on
 * the API yet. This is the agreed contract (POST /auth/password/reset with the
 * token from the email link); the page connects to it automatically once the
 * backend exposes it.
 */
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<void> {
  await apiClient.post("/auth/password/reset", payload);
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: RegisteredUser;
}

/** Sign in with email and password. The refresh token is set as an HttpOnly cookie by the API. */
export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", payload);
  return data;
}

/** Fetch the signed-in user's profile. */
export async function getMe(accessToken: string): Promise<RegisteredUser> {
  const { data } = await apiClient.get<RegisteredUser>("/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * The URL that starts the Google OAuth redirect flow on the backend.
 * The backend exchanges the code server-side and bounces the browser back
 * to /google/callback with the access token in the URL fragment.
 */
export function googleSignInUrl(): string {
  return `${apiClient.defaults.baseURL}/auth/google/login`;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
}

/** Update the signed-in user's profile. Returns the fresh user object. */
export async function updateProfile(
  payload: UpdateProfilePayload,
  accessToken: string,
): Promise<RegisteredUser> {
  const { data } = await apiClient.patch<RegisteredUser>("/users/me", payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/** Change the account password. Other sessions are signed out. */
export async function changePassword(
  payload: { current_password?: string; new_password: string },
  accessToken: string,
): Promise<RegisteredUser> {
  const { data } = await apiClient.post<RegisteredUser>(
    "/users/me/password",
    payload,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

/** Upload a profile photo (JPEG/PNG/WebP, max 2 MB). Returns the updated user. */
export async function uploadAvatar(
  file: File,
  accessToken: string,
): Promise<RegisteredUser> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<RegisteredUser>(
    "/users/me/avatar",
    form,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return data;
}

/** Sign out: revokes the refresh session server-side (best effort) and is
 * always paired with clearing the local session in the UI. */
export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    /* local sign-out proceeds regardless */
  }
}
