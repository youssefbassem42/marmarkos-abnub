import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useVerseAnalyticsOverview() {
  return useQuery({
    queryKey: [...bibleKeys.all, "analytics", "overview"],
    queryFn: bibleApi.getAnalyticsOverview,
  });
}
