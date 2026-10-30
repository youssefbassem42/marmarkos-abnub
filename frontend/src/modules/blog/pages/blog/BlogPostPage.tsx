import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ImageOff, UserRound } from "lucide-react";

import { ErrorRetry } from "@/components/common/ErrorRetry";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateOrEmpty } from "@/lib/datetime";
import { CommentSection } from "../../components/CommentSection";
import { useBlogPost } from "../../hooks";

/** One published post and its server-sanitised HTML body. */
export function BlogPostPage() {
  const { t } = useTranslation("blog");
  const { slug = "" } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const query = useBlogPost(slug, { enabled: Boolean(slug) });

  const tagHref = (tagSlug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tag", tagSlug);
    next.delete("page");
    return `/blog?${next.toString()}`;
  };

  if (query.isPending) {
    return (
      <div className="min-h-screen bg-soft">
        <main className="mx-auto w-full max-w-4xl space-y-5 px-5 py-8">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="min-h-screen bg-soft">
        <main className="mx-auto w-full max-w-4xl space-y-5 px-5 py-8">
          <PageHeader
            title={t("post.notFoundTitle")}
            description={t("post.notFoundBody")}
            backTo="/blog"
            backLabel={t("post.backToList")}
          />
          <ErrorRetry onRetry={() => void query.refetch()} />
        </main>
      </div>
    );
  }

  const post = query.data;
  const publishedDate = formatDateOrEmpty(
    post.published_at,
    { year: "numeric", month: "long", day: "numeric" },
    "ar-EG",
  );

  return (
    <div className="min-h-screen bg-soft">
      <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-6 lg:py-8">
        <PageHeader
          title={post.title}
          description={t("post.byAuthor", {
            name: post.author.full_name,
          })}
          backTo="/blog"
          backLabel={t("post.backToList")}
        />

        <article className="card-elevated overflow-hidden rounded-2xl border border-border bg-card">
          {post.cover_image ? (
            <img
              src={post.cover_image}
              alt={t("post.coverAlt", { title: post.title })}
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center bg-soft text-muted-foreground">
              <ImageOff className="h-12 w-12" aria-hidden="true" />
            </div>
          )}

          <div className="space-y-6 p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {t("post.author", { name: post.author.full_name })}
              </span>
              {publishedDate ? (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {t("post.publishedAt", { date: publishedDate })}
                </span>
              ) : null}
            </div>

            {post.excerpt ? (
              <p className="max-w-prose text-base leading-8 text-muted-foreground">
                {post.excerpt}
              </p>
            ) : null}

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
                  >
                    {tag.name}
                  </Link>
                </Badge>
              ))}
            </div>

            {/*
              The body is sanitised HTML prepared by the backend. It is the
              server's sanitisation contract - not a member's raw value - that
              makes this render safe.
            */}
            <div
              className="prose-editor max-w-prose space-y-4 font-arabic leading-8 text-ink [&_a]:text-brand-blue [&_blockquote]:border-s-4 [&_blockquote]:border-mint [&_blockquote]:ps-4 [&_h1]:font-heading [&_h2]:font-heading [&_li]:my-1 [&_ol]:list-decimal [&_p]:my-3 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          </div>
        </article>

        <CommentSection postId={post.id} />
      </main>
    </div>
  );
}

export default BlogPostPage;
