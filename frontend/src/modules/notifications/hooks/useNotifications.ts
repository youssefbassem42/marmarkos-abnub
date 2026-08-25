import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../api";
import { notificationKeys } from "../api/queryKeys";
import type { NotificationListParams } from "../types";

/** One page of the feed; `keepPreviousData` keeps pagination smooth. */
export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
  });
}
