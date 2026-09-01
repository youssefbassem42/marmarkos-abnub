/**
 * Points API client
 */

import { apiClient } from "@/lib/api";
import type {
  MonthlyPointsResponse,
  Paginated,
  PointsHistoryItem,
  PointsHistoryParams,
  PointsResponse,
} from "../types";

export const pointsApi = {
  /** Current user's point totals */
  getMyPoints: async (): Promise<PointsResponse> => {
    const response = await apiClient.get("/points/me");
    return response.data;
  },

  /** Monthly points series for the current user */
  getMonthlyPoints: async (): Promise<MonthlyPointsResponse[]> => {
    const response = await apiClient.get("/points/me/monthly");
    return response.data;
  },

  /** Paginated points history for the current user */
  getMyHistory: async (
    params?: PointsHistoryParams,
  ): Promise<Paginated<PointsHistoryItem>> => {
    const response = await apiClient.get("/points/me/history", { params });
    return response.data;
  },
};
