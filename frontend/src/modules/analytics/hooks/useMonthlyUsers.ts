import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api";
import { analyticsKeys } from "../api/queryKeys";
import type { MonthlyUsersParams } from "../types";

/** The paginated members table of one month. */
export function useMonthlyUsers(month: string, params?: MonthlyUsersParams) {
  return useQuery({
    queryKey: analyticsKeys.monthlyUsers(month, params),
    queryFn: () => analyticsApi.getMonthlyUsers(month, params),
  });
}
