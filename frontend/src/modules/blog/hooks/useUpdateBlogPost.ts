import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogPostUpdatePayload } from "../types";

/** Update a post. */
export function useUpdateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      data,
    }: {
      postId: string;
      data: BlogPostUpdatePayload;
    }) => blogApi.updatePost(postId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.posts() });
      void queryClient.invalidateQueries({
        queryKey: blogKeys.detail(variables.postId),
      });
    },
  });
}
