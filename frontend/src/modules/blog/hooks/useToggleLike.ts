import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/** Give or take back a post's like and refresh the server's answer. */
export function useToggleLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shouldLike: boolean) =>
      shouldLike ? blogApi.like(postId) : blogApi.unlike(postId),
    onSuccess: (answer) => {
      queryClient.setQueryData(blogKeys.likes(postId), answer);
      void queryClient.invalidateQueries({
        queryKey: blogKeys.likes(postId),
      });
    },
  });
}
