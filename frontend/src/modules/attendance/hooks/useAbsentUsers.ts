import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Expected users without an attended record; provisional before the cutoff. */
export function useAbsentUsers(meetingDate?: string) {
  return useQuery({
    queryKey: attendanceKeys.absent(meetingDate),
    queryFn: () => attendanceApi.getAbsentUsers(meetingDate),
  });
}
