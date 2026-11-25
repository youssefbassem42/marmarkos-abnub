import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth";
import { useToggleCommentLike } from "../hooks";

interface CommentLikeButtonProps {
  commentId: string;
  likesCount: number;
  liked: boolean;
}

/** The small like button of a comment or a reply. */
export function CommentLikeButton({
  commentId,
  likesCount,
  liked,
}: CommentLikeButtonProps) {
  const { t } = useTranslation("blog");
  const viewer = getAuthUser();
  const toggle = useToggleCommentLike(commentId);
  const visibleCount = Math.max(0, Math.trunc(likesCount));
  const label = liked
    ? t("comments.liked", { count: visibleCount })
    : t("comments.like", { count: visibleCount });

  if (!viewer) {
    return (
      <Link
        to="/login"
        className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-brand-blue"
        aria-label={t("comments.signInToLike")}
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
        {visibleCount}
      </Link>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={() => toggle.mutate(!liked)}
      disabled={toggle.isPending}
      aria-pressed={liked}
      aria-label={label}
    >
      <Heart
        className={`h-4 w-4 ${liked ? "fill-brand-red text-brand-red" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      {visibleCount}
    </Button>
  );
}

export default CommentLikeButton;
