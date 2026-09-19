import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export interface VerseAnalyticsUsersParams {
  q?: string;
  read?: "all" | "read" | "unread";
  page?: number;
  size?: number;
}

export function useVerseAnalyticsUsers(
  verseId: string,
  params: VerseAnalyticsUsersParams = {},
) {
  return useQuery({
    queryKey: [...bibleKeys.all, "analytics", "verse", verseId, "users", params],
    queryFn: () => bibleApi.getVerseAnalyticsUsers(verseId, params),
    enabled: !!verseId,
  });
}