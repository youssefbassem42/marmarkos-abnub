import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";
import type { BibleVersesListParams } from "../types";

export function useAdminVerses(params?: BibleVersesListParams) {
  return useQuery({
    queryKey: bibleKeys.verseList(params),
    queryFn: () => bibleApi.getVerses(params),
    placeholderData: keepPreviousData,
  });
}
