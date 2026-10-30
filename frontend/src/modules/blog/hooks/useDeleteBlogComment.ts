import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** Soft-delete a comment and refresh the tree that contains it. */
export function useDeleteBlogComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => blogApi.deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blogKeys.comments(postId),
      });
    },
  });
}
