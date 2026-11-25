import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogPostsListParams } from "../types";

/** The blog list (published posts for members, every state for staff). */
export function useBlogPosts(params?: BlogPostsListParams) {
  return useQuery({
    queryKey: blogKeys.list(params),
    queryFn: () => blogApi.getPosts(params),
    placeholderData: keepPreviousData,
  });
}
