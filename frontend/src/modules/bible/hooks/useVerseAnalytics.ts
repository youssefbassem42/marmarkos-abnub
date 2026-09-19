import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useVerseAnalytics(verseId: string) {
  return useQuery({
    queryKey: [...bibleKeys.all, "analytics", "verse", verseId],
    queryFn: () =>
      bibleApi.getVerseAnalytics(verseId, { granularity: "daily" }),
    enabled: !!verseId,
  });
}