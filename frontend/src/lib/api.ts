import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({ baseURL: apiBaseUrl });

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  role: string;
  status: string;
  public_id: string;
  created_at: string;
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
