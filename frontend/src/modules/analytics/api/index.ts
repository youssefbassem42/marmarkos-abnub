/**
 * Analytics API client (`/quiz-analytics/*`).
 *
 * The month is always sent in the canonical `YYYY-MM` shape: it is the
 * only shape the server accepts (the legacy `?year=&month=` pair was
 * removed in Phase 3.1 - it was never published).
 */

import { apiClient } from "@/lib/api";
import { paginated } from "@/lib/schemas/common";
import {
  monthlyAnalyticsSchema,
  monthlyUserDetailSchema,
  monthlyUserItemSchema,
} from "@/lib/schemas/member";
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
      schema: monthlyAnalyticsSchema,
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
      schema: paginated(monthlyUserItemSchema),
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
      schema: monthlyUserDetailSchema,
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
