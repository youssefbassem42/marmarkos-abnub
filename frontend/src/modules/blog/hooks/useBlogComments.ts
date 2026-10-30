import { useQuery } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogCommentsListParams } from "../types";

/** The visible comment tree of a published post. */
export function useBlogComments(
  postId: string,
  params?: BlogCommentsListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: blogKeys.comments(postId, params),
    queryFn: () => blogApi.getComments(postId, params),
    enabled: Boolean(postId) && options?.enabled !== false,
  });
}
