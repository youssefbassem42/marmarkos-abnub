import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../api";
import { notificationKeys } from "../api/queryKeys";
import { getAccessToken } from "@/lib/auth";

/**
 * D-4: unread badge + tab counts. The ONLY polling query in the app —
 * 60s refetch plus refresh on window focus keeps the badge at most a
 * minute stale without websockets. Skipped entirely for anonymous
 * visitors so signed-out pages issue no notification requests.
 */
export function useNotificationSummary() {
  const authenticated = getAccessToken() !== null;

  return useQuery({
    queryKey: notificationKeys.summary(),
    queryFn: () => notificationsApi.summary(),
    enabled: authenticated,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
