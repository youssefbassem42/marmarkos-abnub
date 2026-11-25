import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, MessageSquare } from "lucide-react";

import type { BlogPostSummary } from "../types";

interface BlogEngagementCountsProps {
  post: BlogPostSummary;
}

interface EngagementFields {
  likes_count?: number;
  comments_count?: number;
}

/** A count that is safe to put on the screen. */
function visibleCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * The engagement of a post in the list.
 *
 * Both numbers lead to the post and carry the icon of what they count. A
 * zero is left out: the member does not need to read that nobody has
 * interacted with the post yet.
 */
export function BlogEngagementCounts({ post }: BlogEngagementCountsProps) {
  const { t } = useTranslation("blog");
  const engagement = post as BlogPostSummary & EngagementFields;
  const likesCount = visibleCount(engagement.likes_count);
  const commentsCount = visibleCount(engagement.comments_count);
  const postHref = `/blog/${post.id}`;

  if (likesCount === 0 && commentsCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {likesCount > 0 ? (
        <Link
          to={postHref}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md hover:text-brand-blue"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          <span>{t("card.likesCount", { count: likesCount })}</span>
        </Link>
      ) : null}
      {commentsCount > 0 ? (
        <Link
          to={postHref}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md hover:text-brand-blue"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span>{t("card.commentsCount", { count: commentsCount })}</span>
        </Link>
      ) : null}
    </div>
  );
}

export default BlogEngagementCounts;
