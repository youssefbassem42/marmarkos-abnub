import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";
import type { CheckInRequest } from "../types";

/**
 * Records a check-in and invalidates every attendance query so the
 * roster, stats and recent list reflect the scan immediately.
 * Callers inspect the thrown ApiError.status (409/422/403/0) to pick
 * the right result state.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CheckInRequest) => attendanceApi.checkIn(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}
