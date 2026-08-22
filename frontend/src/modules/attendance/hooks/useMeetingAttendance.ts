import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Live roster of one meeting; staleTime 0 so a fresh scan shows immediately. */
export function useMeetingAttendance(meetingDate?: string) {
  return useQuery({
    queryKey: attendanceKeys.meeting(meetingDate),
    queryFn: () => attendanceApi.getMeetingAttendance(meetingDate),
    staleTime: 0,
  });
}
