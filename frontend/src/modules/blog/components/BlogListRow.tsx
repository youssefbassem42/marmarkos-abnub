import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ImageOff, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateOrEmpty } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { BlogEngagementCounts } from "./BlogEngagementCounts";
import { ShareButton } from "./ShareButton";
import type { BlogPostSummary } from "../types";

interface BlogListRowProps {
  post: BlogPostSummary;
  className?: string;
  management?: ReactNode;
}

/** One published post as a compact row of the list view. */
export function BlogListRow({ post, className, management }: BlogListRowProps) {
  const { t } = useTranslation("blog");
  const [searchParams] = useSearchParams();

  const tagHref = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tag", slug);
    next.delete("page");
    return `/blog?${next.toString()}`;
  };

  const publishedDate = formatDateOrEmpty(
    post.published_at,
    { year: "numeric", month: "long", day: "numeric" },
    "ar-EG",
  );

  return (
    <article
      className={cn(
        "card-elevated flex gap-4 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <Link
        to={`/blog/${post.id}`}
        className="focus-ring hidden aspect-[16/9] w-40 shrink-0 overflow-hidden rounded-xl bg-soft sm:block"
      >
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={t("card.coverAlt", { title: post.title })}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="border-transparent bg-mint/20 text-ink"
            >
              <Link
                to={tagHref(tag.slug)}
                className="focus-ring rounded-md"
                onClick={(event) => event.stopPropagation()}
              >
                {tag.name}
              </Link>
            </Badge>
          ))}
        </div>

        <h2 className="font-heading text-lg font-bold leading-snug text-ink">
          <Link
            to={`/blog/${post.id}`}
            className="focus-ring rounded-md hover:text-brand-blue"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt ? (
          <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
        ) : null}

        {management}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {t("card.byAuthor", { name: post.author.full_name })}
          </span>
          {publishedDate ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t("card.publishedAt", { date: publishedDate })}
            </span>
          ) : null}
          <BlogEngagementCounts post={post} />
          <ShareButton post={post} />
        </div>
      </div>
    </article>
  );
}
