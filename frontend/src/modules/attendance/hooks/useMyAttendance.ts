import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** The signed-in member's own attendance for one month (US-012). */
export function useMyAttendance(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.mine(year, month),
    queryFn: () => attendanceApi.getMyAttendance(year, month),
  });
}
