import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import { blogKeys } from "../api/queryKeys";

/**
 * Give or take back a post's like.
 *
 * The answer of the server **is** the state of the like: the number and
 * the state of the member are written into the cache as they arrived.
 * The query is not invalidated on purpose: a refetch right after the
 * change would answer with a state that a member of another device may
 * have changed in the meantime, and the number on the screen would jump
 * backwards.
 */
export function useToggleLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shouldLike: boolean) =>
      shouldLike ? blogApi.like(postId) : blogApi.unlike(postId),
    onSuccess: (answer) => {
      queryClient.setQueryData(blogKeys.likes(postId), answer);
    },
  });
}
