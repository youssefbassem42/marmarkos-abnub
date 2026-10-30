import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogCommentCreatePayload } from "../types";

/** Publish a comment or a reply and refresh its post's tree. */
export function useCreateBlogComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BlogCommentCreatePayload) =>
      blogApi.createComment(postId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blogKeys.comments(postId),
      });
    },
  });
}
