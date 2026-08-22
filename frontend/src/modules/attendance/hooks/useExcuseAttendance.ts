import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";

/** ADMIN-only correction (BR-6); refreshes every attendance view. */
export function useExcuseAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attendanceId,
      reason,
    }: {
      attendanceId: string;
      reason?: string;
    }) => attendanceApi.excuseAttendance(attendanceId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}
