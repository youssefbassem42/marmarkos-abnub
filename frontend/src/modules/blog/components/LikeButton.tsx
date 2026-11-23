import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth";

import { usePostLikes, useToggleLike } from "../hooks";

interface LikeButtonProps {
  postId: string;
}

/**
 * The like of a post.
 *
 * The number that is shown is **always** the number the server answered:
 * the frontend never counts on its own. A visitor that is not signed in
 * sees the number and is asked to sign in (the platform is Arabic and
 * the sign-in is a link).
 */
export function LikeButton({ postId }: LikeButtonProps) {
  const { t } = useTranslation("blog");
  const viewer = getAuthUser();
  const query = usePostLikes(postId);
  const toggle = useToggleLike(postId);

  const likesCount = query.data?.likes_count ?? 0;
  const liked = query.data?.liked ?? false;

  const label = liked
    ? t("likes.liked", { count: likesCount })
    : t("likes.like", { count: likesCount });

  if (!viewer) {
    return (
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          aria-label={label}
        >
          <Heart className="h-5 w-5" aria-hidden="true" />
          {likesCount}
        </span>
        <Link to="/login" className="focus-ring text-sm text-brand-blue">
          {t("likes.signInHint")}
        </Link>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="inline-flex items-center gap-2"
      onClick={() => toggle.mutate(!liked)}
      disabled={toggle.isPending}
      aria-pressed={liked}
      aria-label={label}
    >
      <Heart
        className={`h-5 w-5 ${liked ? "fill-brand-red text-brand-red" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      {likesCount}
    </Button>
  );
}

export default LikeButton;
