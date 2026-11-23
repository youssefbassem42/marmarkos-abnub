import { useQuery } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** The active likes of a published post and the member's own like state. */
export function usePostLikes(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: blogKeys.likes(postId),
    queryFn: () => blogApi.getLikes(postId),
    enabled: Boolean(postId) && options?.enabled !== false,
  });
}
