import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** Publish a post immediately. */
export function usePublishBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => blogApi.publishPost(postId),
    onSuccess: (_data, postId) => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.posts() });
      void queryClient.invalidateQueries({
        queryKey: blogKeys.detail(postId),
      });
    },
  });
}
