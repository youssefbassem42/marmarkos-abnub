import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api";
import { analyticsKeys } from "../api/queryKeys";

/** The KPIs, the trend and the top members of one month. */
export function useMonthlyAnalytics(month: string) {
  return useQuery({
    queryKey: analyticsKeys.monthly(month),
    queryFn: () => analyticsApi.getMonthly(month),
  });
}
