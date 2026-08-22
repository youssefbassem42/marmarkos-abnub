import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Monthly analysis with the per-meeting breakdown for charts. */
export function useMonthlyStatistics(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.monthlyStats(year, month),
    queryFn: () => attendanceApi.getMonthlyStatistics(year, month),
  });
}
