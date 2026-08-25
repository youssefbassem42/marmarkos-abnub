import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { clearAuth, getAccessToken, updateAccessToken } from "@/lib/auth";

function resolveApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

  if (raw.startsWith("/")) {
    const trimmed = raw.replace(/\/+$/, "");
    return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
  }

  // Guard against a base URL set without its scheme (axios would then treat
  // "example.com/api/v1" as a relative path on the current origin).
  let absolute = raw;
  if (!/^https?:\/\//i.test(absolute)) {
    absolute =
      absolute.startsWith("localhost") || absolute.startsWith("127.")
        ? `http://${absolute}`
        : `https://${absolute}`;
  }
  // All backend routes live under /api/v1; tolerate a bare host.
  const trimmed = absolute.replace(/\/+$/, "");
  return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

// withCredentials lets the HttpOnly refresh cookie ride along. It is required
// only for cross-origin calls, but it is correct in both setups and keeps the
// silent-refresh flow working if the API ever moves off this origin.
export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

/** Paths that must never carry the bearer token. */
const AUTH_FREE_PREFIXES = [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/password",
  // NOTE: /anonymous-messages is deliberately NOT listed here (P4-701).
  // Submission is public (D-9), but this interceptor cannot distinguish
  // the public POST from the ADMIN-only listing on the same path; an
  // ignored bearer token on the POST is harmless (the server treats the
  // caller as anonymous for rate limiting), while a stripped one on the
  // admin GET would break it with a spurious 401.
];

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

/**
 * Silent access-token refresh.
 *
 * The access token lives 30 minutes; the refresh token is an HttpOnly cookie
 * scoped to /api/v1/auth. Before this existed, an expired access token meant
 * every request 401'd forever while the stored user object kept the UI looking
 * signed in — a session that was dead but invisible.
 *
 * This is the only response interceptor: it must see the raw AxiosError, so
 * the ApiError conversion happens here at the end of the chain rather than in
 * a separate earlier interceptor.
 */
const REFRESH_URL = "/auth/refresh";

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** Shared so a burst of parallel 401s triggers exactly one refresh. */
let refreshInFlight: Promise<string> | null = null;

async function requestFreshAccessToken(): Promise<string> {
  const { data } = await apiClient.post<TokenResponse>(REFRESH_URL);
  updateAccessToken(data.access_token);
  return data.access_token;
}

function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= requestFreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function abandonSession(): void {
  clearAuth();
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(toApiError(error));
    }

    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? "";
    const refreshable =
      error.response?.status === 401 &&
      config !== undefined &&
      config._retried !== true &&
      // Never recurse through the refresh call, and never fight a genuine
      // bad-credentials 401 from login itself.
      !url.startsWith("/auth/") &&
      getAccessToken() !== null;

    if (!refreshable) {
      return Promise.reject(toApiError(error));
    }

    config._retried = true;
    try {
      const accessToken = await refreshAccessToken();
      // Overwrite rather than fill in: callers that pass an explicit
      // Authorization header are holding the token that just expired.
      config.headers.Authorization = `Bearer ${accessToken}`;
      return await apiClient.request(config);
    } catch {
      // The refresh cookie is gone or revoked: this session is finished.
      abandonSession();
      return Promise.reject(toApiError(error));
    }
  },
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
  email_verified: boolean;
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
 * Ask the API to email a password reset link. The backend always answers
 * with a neutral success so it never reveals which emails exist.
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

/** Consume the emailed reset token and set the new password. */
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<void> {
  await apiClient.post("/auth/password/reset", payload);
}

export interface VerifyEmailPayload {
  token: string;
}

/** Consume the emailed verification token and activate the account. */
export async function verifyEmail(payload: VerifyEmailPayload): Promise<void> {
  await apiClient.post("/auth/verify-email", payload);
}

/**
 * Re-send the verification link for an address that has not been
 * confirmed yet. The backend answers neutrally (no account enumeration).
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  await apiClient.post("/auth/resend-verification", { email });
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

/** Body of POST /auth/refresh — a new access token, no user object. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
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
