import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useVerse(
  verseId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bibleKeys.detail(verseId),
    queryFn: () => bibleApi.getVerse(verseId),
    ...options,
  });
}
