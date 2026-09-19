import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** Expected users without an attended record; provisional before the cutoff. */
export function useAbsentUsers(
  meetingDate?: string,
  options?: { page?: number; size?: number },
) {
  const { page, size } = options ?? {};
  return useQuery({
    queryKey: attendanceKeys.absent(meetingDate, page, size),
    queryFn: () => attendanceApi.getAbsentUsers(meetingDate, { page, size }),
  });
}