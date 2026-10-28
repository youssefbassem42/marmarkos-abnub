/**
 * Points API client
 *
 * The endpoints of the points live **under the member**
 * (`/users/me/points`), the way the backend mounts them
 * (`APIRouter(prefix="/users/me/points")`).
 *
 * The client used to call `/points/me`, `/points/me/monthly` and
 * `/points/me/history`: three URLs that answer **404**, so the page of
 * the points showed the empty state to every member - a member with
 * five hundred points was told that he had none.
 */

import { apiClient } from "@/lib/api";
import { paginated } from "@/lib/schemas/common";
import {
  monthlyPointsSchema,
  pointActivityItemSchema,
  pointsSchema,
} from "@/lib/schemas/member";
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
    const response = await apiClient.get("/users/me/points", {
      schema: pointsSchema,
    });
    return response.data;
  },

  /** Monthly points series for the current user */
  getMonthlyPoints: async (): Promise<MonthlyPointsResponse> => {
    const response = await apiClient.get("/users/me/points/monthly", {
      schema: monthlyPointsSchema,
    });
    return response.data;
  },

  /** Paginated points history for the current user */
  getMyHistory: async (
    params?: PointsHistoryParams,
  ): Promise<Paginated<PointsHistoryItem>> => {
    const response = await apiClient.get("/users/me/points/history", {
      params,
      schema: paginated(pointActivityItemSchema),
    });
    return response.data;
  },
};
