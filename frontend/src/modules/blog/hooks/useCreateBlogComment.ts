import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useApiError } from "@/hooks/useApiError";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogCommentCreatePayload } from "../types";

/** Publish a comment or a reply and refresh its post's tree. */
export function useCreateBlogComment(postId: string) {
  const queryClient = useQueryClient();
  const describeError = useApiError();

  return useMutation({
    mutationFn: (data: BlogCommentCreatePayload) =>
      blogApi.createComment(postId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: blogKeys.comments(postId),
      });
    },
    onError: (error) => {
      // The reason is told to the member: a silent failure looks like a
      // comment that was swallowed.
      toast.error(describeError(error).message);
    },
  });
}
