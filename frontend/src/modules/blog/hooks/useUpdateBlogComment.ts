import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogCommentUpdatePayload } from "../types";

/** Edit a comment and refresh the tree that contains it. */
export function useUpdateBlogComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      data,
    }: {
      commentId: string;
      data: BlogCommentUpdatePayload;
    }) => blogApi.updateComment(commentId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blogKeys.comments(postId),
      });
    },
  });
}
