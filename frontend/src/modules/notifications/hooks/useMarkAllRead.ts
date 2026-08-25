import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api";
import { notificationKeys } from "../api/queryKeys";

/** BR-4: sweep every visible unread row, ignoring tabs and filters. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
