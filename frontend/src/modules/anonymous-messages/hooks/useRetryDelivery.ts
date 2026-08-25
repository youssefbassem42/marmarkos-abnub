import { useMutation, useQueryClient } from "@tanstack/react-query";
import { anonymousMessagesApi } from "../api";
import { anonymousMessageKeys } from "../api/queryKeys";
import type { MessageStatusValue } from "../types";

interface RetryDeliveryParams {
  status?: MessageStatusValue;
}

/** BR-14: re-attempt a FAILED forward; refreshes the listing. */
export function useRetryDelivery(params: RetryDeliveryParams = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => anonymousMessagesApi.retry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: anonymousMessageKeys.all,
      });
      // Keep params referenced so callers can scope invalidation later.
      void params.status;
    },
  });
}
