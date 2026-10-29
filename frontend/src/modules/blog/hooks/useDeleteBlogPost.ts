import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** Archive a post (the deletion is soft). */
export function useDeleteBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => blogApi.deletePost(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.posts() });
    },
  });
}
