import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { AdminBlogPostsListParams } from "../types";

/** Every post for the administration. */
export function useAdminBlogPosts(params?: AdminBlogPostsListParams) {
  return useQuery({
    queryKey: blogKeys.adminList(params),
    queryFn: () => blogApi.getAdminPosts(params),
    placeholderData: keepPreviousData,
  });
}
