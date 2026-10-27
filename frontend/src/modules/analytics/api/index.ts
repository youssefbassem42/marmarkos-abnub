/**
 * Analytics API client (`/quiz-analytics/*`).
 *
 * The month is always sent in the canonical `YYYY-MM` shape; the legacy
 * `?year=&month=` shape is deprecated on the server and is not used here.
 */

import { apiClient } from "@/lib/api";
import type {
  MonthlyAnalytics,
  MonthlyUserDetail,
  MonthlyUserItem,
  MonthlyUsersParams,
  Paginated,
} from "../types";

/** The current month as the canonical `YYYY-MM` string. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const analyticsApi = {
  /** KPIs, trend, completion distribution and the top three members. */
  getMonthly: async (month: string): Promise<MonthlyAnalytics> => {
    const response = await apiClient.get("/quiz-analytics/monthly", {
      params: { month },
    });
    return response.data;
  },

  /** The paginated members table of one month. */
  getMonthlyUsers: async (
    month: string,
    params?: MonthlyUsersParams,
  ): Promise<Paginated<MonthlyUserItem>> => {
    const response = await apiClient.get("/quiz-analytics/monthly/users", {
      params: { month, ...params },
    });
    return response.data;
  },

  /** One member: the per-quiz breakdown and the month history. */
  getUserMonth: async (
    userId: string,
    month: string,
  ): Promise<MonthlyUserDetail> => {
    const response = await apiClient.get(`/quiz-analytics/users/${userId}`, {
      params: { month },
    });
    return response.data;
  },

  /** The CSV export of the members table. */
  exportMonthly: async (
    month: string,
    params?: MonthlyUsersParams,
  ): Promise<Blob> => {
    const response = await apiClient.get("/quiz-analytics/monthly/export", {
      params: { month, ...params },
      responseType: "blob",
    });
    return response.data as Blob;
  },
};
