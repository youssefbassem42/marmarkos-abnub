import { useQuery } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** One post (a draft is visible to its author and to the staff). */
export function useBlogPost(postId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: blogKeys.detail(postId),
    queryFn: () => blogApi.getPost(postId),
    ...options,
  });
}
