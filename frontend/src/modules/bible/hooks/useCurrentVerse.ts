import { useQuery } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useCurrentVerse() {
  return useQuery({
    queryKey: bibleKeys.current(),
    queryFn: () => bibleApi.getCurrent(),
  });
}
