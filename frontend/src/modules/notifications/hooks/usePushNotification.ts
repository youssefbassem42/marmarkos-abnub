import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api";
import { notificationKeys } from "../api/queryKeys";
import type { PushNotificationRequest } from "../types";

/** BR-6/BR-8: ADMIN broadcast push; slow when emailing (R-1). */
export function usePushNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PushNotificationRequest) =>
      notificationsApi.push(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
