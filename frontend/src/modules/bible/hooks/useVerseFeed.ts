import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";
import type { PublishedVersesParams } from "../types";

export function useVerseFeed(params?: PublishedVersesParams) {
  return useQuery({
    queryKey: bibleKeys.published(params),
    queryFn: () => bibleApi.getPublished(params),
    placeholderData: keepPreviousData,
  });
}
