import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ImageOff, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateOrEmpty } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { BlogPostSummary } from "../types";

interface BlogCardProps {
  post: BlogPostSummary;
  className?: string;
}

/** One published post as a card. */
export function BlogCard({ post, className }: BlogCardProps) {
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
        "card-elevated flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <Link
        to={`/blog/${post.id}`}
        className="focus-ring block aspect-[16/9] overflow-hidden bg-soft"
      >
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={t("card.coverAlt", { title: post.title })}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm">{t("card.noCover")}</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
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

        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold leading-snug text-ink">
            <Link
              to={`/blog/${post.id}`}
              className="focus-ring rounded-md hover:text-brand-blue"
            >
              {post.title}
            </Link>
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
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
        </div>
      </div>
    </article>
  );
}
