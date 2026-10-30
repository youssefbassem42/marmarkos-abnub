import { useQuery } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** One post for the administration (a draft included). */
export function useAdminBlogPost(
  postId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: blogKeys.adminDetail(postId),
    queryFn: () => blogApi.getAdminPost(postId),
    ...options,
  });
}
