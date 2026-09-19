import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useVerseQuickStats() {
  return useQuery({
    queryKey: [...bibleKeys.all, "analytics", "quick-stats"],
    queryFn: bibleApi.getQuickStats,
  });
}