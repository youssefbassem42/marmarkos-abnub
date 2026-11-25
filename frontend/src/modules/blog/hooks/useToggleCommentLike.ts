import { useMutation, useQueryClient } from "@tanstack/react-query";

import { blogApi } from "../api";
import type { BlogCommentLike } from "../types";
import { blogKeys } from "../api/queryKeys";

interface LikeableComment {
  id: string;
  likes_count: number;
  liked: boolean;
  replies: LikeableComment[];
}

interface CommentPage {
  items: LikeableComment[];
}

/**
 * Put the answer of the server into one comment of a tree.
 *
 * The function returns the same tree when the comment is not in it. The
 * tree is walked recursively because a reply is a comment too.
 */
function updateComment(
  comment: LikeableComment,
  commentId: string,
  answer: BlogCommentLike,
): [comment: LikeableComment, changed: boolean] {
  if (comment.id === commentId) {
    return [
      {
        ...comment,
        likes_count: answer.likes_count,
        liked: answer.liked,
      },
      true,
    ];
  }

  let repliesChanged = false;
  const replies = comment.replies.map((reply) => {
    const [updated, changed] = updateComment(reply, commentId, answer);
    repliesChanged = repliesChanged || changed;
    return updated;
  });

  if (!repliesChanged) return [comment, false];
  return [{ ...comment, replies }, true];
}

/**
 * Give or take back the like of a comment or a reply.
 *
 * The answer of the server is written into the cached tree and into the
 * likes of that comment. The comments are not invalidated: a refetch
 * right after the change could bring an older count back to the screen.
 */
export function useToggleCommentLike(commentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shouldLike: boolean) =>
      shouldLike
        ? blogApi.likeComment(commentId)
        : blogApi.unlikeComment(commentId),
    onSuccess: (answer) => {
      queryClient.setQueryData(blogKeys.commentLikes(commentId), answer);
      queryClient.setQueriesData<CommentPage>(
        { queryKey: blogKeys.commentTrees() },
        (page) => {
          if (!page) return page;

          let changed = false;
          const items = page.items.map((comment) => {
            const [updated, commentChanged] = updateComment(
              comment,
              commentId,
              answer,
            );
            changed = changed || commentChanged;
            return updated;
          });

          return changed ? { ...page, items } : page;
        },
      );
    },
  });
}
