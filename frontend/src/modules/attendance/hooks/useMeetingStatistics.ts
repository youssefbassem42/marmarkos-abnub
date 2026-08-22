import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Per-meeting summary; staleTime 0 so a fresh scan shows immediately. */
export function useMeetingStatistics(meetingDate?: string) {
  return useQuery({
    queryKey: attendanceKeys.meetingStats(meetingDate),
    queryFn: () => attendanceApi.getMeetingStatistics(meetingDate),
    staleTime: 0,
  });
}
