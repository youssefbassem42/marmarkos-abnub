import axios from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { z } from "zod";
import { clearAuth, getAccessToken, updateAccessToken } from "@/lib/auth";

function resolveApiBaseUrl(): string {
  // The default is the relative path on purpose: the browser must only ever
  // talk to its own origin, or the HttpOnly refresh cookie (SameSite=Lax,
  // path=/api/v1/auth) is dropped and the session dies after 30 minutes with
  // no way to recover. The relative path is served by the Vite proxy in the
  // development, by the rewrite in vercel.json and by the nginx proxy in the
  // container image.
  //
  // The old default was the absolute "http://localhost:8000/api/v1": without
  // VITE_API_BASE_URL in the environment (the Docker image, a fresh clone),
  // the browser of the member then called *its own* localhost - the API was
  // unreachable and the refresh cookie never came back.
  const raw = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

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

declare module "axios" {
  /** The schema of the answer: the answer is checked against it. */
  export interface AxiosRequestConfig {
    schema?: z.ZodType;
  }
  export interface InternalAxiosRequestConfig {
    schema?: z.ZodType;
  }
}

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
  let dataPayload: Record<string, unknown> | undefined;

  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") message = first.msg;
  } else if (detail && typeof detail === "object") {
    const record = detail as {
      code?: unknown;
      message?: unknown;
      data?: unknown;
    };
    if (typeof record.code === "string") code = record.code;
    if (typeof record.message === "string") message = record.message;
    if (record.data && typeof record.data === "object") {
      dataPayload = record.data as Record<string, unknown>;
    }
  }

  if (!message && typeof error.message === "string" && error.message) {
    message = error.message;
  }

  return new ApiError(status, message ?? "Request failed", code, dataPayload);
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

/**
 * The proactive refresh.
 *
 * The token is refreshed at 80 % of its life: the member never meets an
 * expired token, and the session does not depend on a request that has to
 * fail first.
 *
 * Without it the session only survived because a request happened to answer
 * 401 - and when that refresh failed (a network hiccup, a cold start, a
 * rate limit), the member was logged out in the middle of the platform
 * ("the session dies after 30 minutes"). The refresh here is the same
 * promise the interceptor uses, so a refresh that is already on its way is
 * never started twice (the refresh token is **rotated**: the second answer
 * would be a 401 on a token that no longer exists).
 */
const REFRESH_AT_RATIO = 0.8;
/** Never refresh earlier than this (a very short token, a test). */
const MIN_REFRESH_DELAY_MS = 30_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Stop the proactive refresh (the sign-out). */
export function stopTokenRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Schedule the next proactive refresh.
 *
 * @param expiresInSeconds the life of the access token that was just
 * handed out.
 */
export function scheduleTokenRefresh(expiresInSeconds: number): void {
  stopTokenRefresh();
  const lifetime = Number.isFinite(expiresInSeconds)
    ? expiresInSeconds * 1000
    : 0;
  if (lifetime <= 0) return;
  const delay = Math.max(MIN_REFRESH_DELAY_MS, lifetime * REFRESH_AT_RATIO);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshAccessToken().catch(() => {
      // A failure here is not fatal: the next request tries again (the
      // interceptor refreshes on a 401) and the session stays alive. The
      // member is only signed out when the server definitively refuses
      // the refresh (401/403).
    });
  }, delay);
}

async function requestFreshAccessToken(timeoutMs?: number): Promise<string> {
  const { data } = await apiClient.post<TokenResponse>(
    REFRESH_URL,
    undefined,
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );
  updateAccessToken(data.access_token);
  scheduleTokenRefresh(data.expires_in);
  return data.access_token;
}

/**
 * The one refresh of the platform.
 *
 * The restore at start-up and the interceptor of a 401 share this promise:
 * the refresh token is rotated by the server, so two parallel refreshes
 * send the same (now revoked) token and the second one is a 401 - which
 * used to sign the member out.
 */
export function refreshAccessToken(options?: {
  timeoutMs?: number;
}): Promise<string> {
  refreshInFlight ??= requestFreshAccessToken(options?.timeoutMs).finally(
    () => {
      refreshInFlight = null;
    },
  );
  return refreshInFlight;
}

function abandonSession(): void {
  stopTokenRefresh();
  clearAuth();
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}

/**
 * True when the failure of a refresh is definitive: the cookie is gone, the
 * session was revoked, or the account is not usable any more.
 *
 * A network error, a timeout, a rate limit or a 5xx of the server are **not**
 * definitive: the session is still valid, the network is not. Signing the
 * member out because the network blinked was the "auto logout after some
 * time" the members reported.
 *
 * The failure arrives in two shapes: the interceptor of the platform turns it
 * into an `ApiError` (with its own `status`) before the caller sees it, and a
 * raw `AxiosError` can arrive from a request that never reached the server.
 */
export function isDefinitiveAuthFailure(error: unknown): boolean {
  const candidate = error as
    { status?: number; response?: { status?: number } } | null | undefined;
  const status = candidate?.status ?? candidate?.response?.status ?? 0;
  return status === 401 || status === 403;
}

apiClient.interceptors.response.use(
  (response) => {
    // The answer is checked against its schema (when the endpoint has
    // one). An answer that does not have the expected shape becomes an
    // `ApiError`: the page shows its error state instead of crashing on
    // `undefined.toFixed()`.
    const schema = response.config?.schema;
    // A 204 carries no body: there is nothing to check (the endpoint
    // `/bible-verses/current` answers 204 when there is no published
    // verse, and the client reads the status, not the body).
    if (schema && response.status !== 204) {
      const parsed = schema.safeParse(response.data);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "answer"}: ${issue.message}`,
          )
          .join(", ");
        throw new ApiError(
          0,
          `The answer of ${response.config?.url ?? "the server"} does not have the expected shape (${detail})`,
          "invalid_response",
        );
      }
      response.data = parsed.data;
    }
    return response;
  },
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
    } catch (refreshError) {
      // Only a definitive refusal ends the session. A network error, a
      // timeout, a rate limit or a 5xx leave the session alive: the
      // member stays signed in and the next request tries again.
      if (isDefinitiveAuthFailure(refreshError)) {
        abandonSession();
      }
      return Promise.reject(toApiError(error));
    }
  },
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A GET whose answer is checked against a schema.
 *
 * The answer that does not have the expected shape becomes an
 * `ApiError` (code `invalid_response`): the page shows its error state
 * instead of reading `undefined`.
 */
export async function apiGet<S extends z.ZodType>(
  url: string,
  schema: S,
  config?: AxiosRequestConfig,
): Promise<z.infer<S>> {
  const response = await apiClient.get(url, { ...config, schema });
  return response.data as z.infer<S>;
}

/**
 * A POST whose answer is checked against a schema.
 *
 * A POST without an answer (`204`, or a 202 that carries nothing) does
 * not need a schema: pass `undefined`.
 */
export async function apiPost<S extends z.ZodType>(
  url: string,
  schema: S | undefined,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<z.infer<S> | undefined> {
  const response = await apiClient.post(url, data, { ...config, schema });
  return response.data as z.infer<S> | undefined;
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

/**
 * Register a new member.
 *
 * The API answers 202 with a fixed message in every case - a known
 * address is not distinguishable from an unknown one (the backend must
 * not become an account oracle), so the response carries no user data.
 */
export async function registerUser(payload: RegisterPayload): Promise<void> {
  await apiClient.post("/auth/register", payload);
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
  // The session must outlive the access token: the proactive refresh is
  // scheduled here, so the member is never logged out when the token
  // expires (the interceptor's refresh is only the safety net).
  scheduleTokenRefresh(data.expires_in);
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

/** Upload a bible verse cover image (JPEG/PNG/WebP, max 2 MB). Returns { url }. */
export async function uploadVerseCover(
  file: File,
  accessToken: string,
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ url: string }>(
    "/bible-verses/cover",
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
  // The proactive refresh must not fire after the sign-out (it would
  // resurrect the session with the cookie that is about to be revoked).
  stopTokenRefresh();
  try {
    await apiClient.post("/auth/logout");
  } catch {
    /* local sign-out proceeds regardless */
  }
}
