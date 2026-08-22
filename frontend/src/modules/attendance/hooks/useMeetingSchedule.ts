import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Meeting calendar for one month (4 meetings, 5 in long months). */
export function useMeetingSchedule(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.schedule(year, month),
    queryFn: () => attendanceApi.getMeetingSchedule(year, month),
  });
}
