import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogPostCreatePayload } from "../types";

/** Create a post as a draft or with a publication date. */
export function useCreateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BlogPostCreatePayload) => blogApi.createPost(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.posts() });
    },
  });
}
