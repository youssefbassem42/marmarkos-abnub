import axios from "axios";

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
  // Guard against a base URL set without its scheme (axios would then treat
  // "example.com/api/v1" as a relative path on the current origin).
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("localhost") || raw.startsWith("127.")) {
    return `http://${raw}`;
  }
  return `https://${raw}`;
}

export const apiClient = axios.create({ baseURL: resolveApiBaseUrl() });

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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Register a new member. Returns the created user (no tokens on register). */
export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisteredUser> {
  try {
    const { data } = await apiClient.post<RegisteredUser>(
      "/auth/register",
      payload,
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
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
  try {
    await apiClient.post("/auth/password/forgot", payload);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
} /**
 * Pending backend integration: the password-reset endpoint does not exist on
 * the API yet. This is the agreed contract (POST /auth/password/reset with the
 * token from the email link); the page connects to it automatically once the
 * backend exposes it.
 */
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<void> {
  try {
    await apiClient.post("/auth/password/reset", payload);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
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
  try {
    const { data } = await apiClient.post<LoginResponse>(
      "/auth/login",
      payload,
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
}

/**
 * Sign in with Google. `credential` is the Google Identity Services ID token
 * obtained by the frontend button; the backend verifies it against Google's
 * signing keys and returns this app's tokens (same shape as password login).
 */
export async function googleLogin(credential: string): Promise<LoginResponse> {
  try {
    const { data } = await apiClient.post<LoginResponse>("/auth/google", {
      credential,
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
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
  try {
    const { data } = await apiClient.patch<RegisteredUser>("/users/me", payload, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
}

/** Change the account password. Other sessions are signed out. */
export async function changePassword(
  payload: { current_password?: string; new_password: string },
  accessToken: string,
): Promise<RegisteredUser> {
  try {
    const { data } = await apiClient.post<RegisteredUser>(
      "/users/me/password",
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
}

/** Upload a profile photo (JPEG/PNG/WebP, max 2 MB). Returns the updated user. */
export async function uploadAvatar(file: File, accessToken: string): Promise<RegisteredUser> {
  try {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<RegisteredUser>("/users/me/avatar", form, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى");
      throw new ApiError(error.response?.status ?? 0, message);
    }
    throw error;
  }
}
