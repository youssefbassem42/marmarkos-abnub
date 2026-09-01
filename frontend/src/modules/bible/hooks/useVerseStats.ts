import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useVerseStats() {
  return useQuery({
    queryKey: bibleKeys.stats(),
    queryFn: () => bibleApi.getStats(),
  });
}
