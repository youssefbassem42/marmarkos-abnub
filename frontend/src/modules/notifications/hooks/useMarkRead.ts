import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api";
import { notificationKeys } from "../api/queryKeys";

/** BR-3: idempotent per-row mark; double-fires stay 200s server-side. */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsApi.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
