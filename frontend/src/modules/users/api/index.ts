import { apiClient } from "@/lib/api";
import type { UserAdminItem } from "../types";

export const usersApi = {
  /** ADMIN-only full user list (roles, status, last login). */
  getUsers: async (): Promise<UserAdminItem[]> => {
    const response = await apiClient.get("/users");
    return response.data;
  },
};