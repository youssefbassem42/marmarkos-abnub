import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";
import type { BlogPostSchedulePayload } from "../types";

/** Schedule a post for a future date. */
export function useScheduleBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      data,
    }: {
      postId: string;
      data: BlogPostSchedulePayload;
    }) => blogApi.schedulePost(postId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.posts() });
      void queryClient.invalidateQueries({
        queryKey: blogKeys.detail(variables.postId),
      });
    },
  });
}
