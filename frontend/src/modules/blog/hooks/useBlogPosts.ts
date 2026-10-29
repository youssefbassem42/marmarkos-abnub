import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogPostsListParams } from "../types";

/** The published posts for the member-facing list. */
export function useBlogPosts(params?: BlogPostsListParams) {
  return useQuery({
    queryKey: blogKeys.publicList(params),
    queryFn: () => blogApi.getPosts(params),
    placeholderData: keepPreviousData,
  });
}
