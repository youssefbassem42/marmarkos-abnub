import { useQuery } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** The published post that owns a tiny, first-party link. */
export function useBlogPostByShortCode(shortCode: string) {
  return useQuery({
    queryKey: blogKeys.shortLookup(shortCode),
    queryFn: () => blogApi.getShortLink(shortCode),
    enabled: Boolean(shortCode),
    retry: false,
  });
}
