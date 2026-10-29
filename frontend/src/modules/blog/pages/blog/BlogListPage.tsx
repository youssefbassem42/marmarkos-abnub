import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogCard } from "../../components/BlogCard";
import { BlogFilters, type BlogView } from "../../components/BlogFilters";
import { BlogListRow } from "../../components/BlogListRow";
import { useBlogPosts } from "../../hooks";
import type { BlogPostsListParams } from "../../types";

const PAGE_SIZE = 12;

/** The public feed of the published blog posts. */
export function BlogListPage() {
  const { t } = useTranslation("blog");
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const view: BlogView = searchParams.get("view") === "list" ? "list" : "cards";

  const apiParams = useMemo<BlogPostsListParams>(
    () => ({
      page,
      size: PAGE_SIZE,
      ...(search ? { q: search } : {}),
      ...(tag ? { tag } : {}),
    }),
    [page, search, tag],
  );
  const query = useBlogPosts(apiParams);

  const patchParams = (patch: Record<string, string | number | undefined>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("tag");
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const posts = query.data?.items ?? [];

  return (
    <div className="min-h-screen bg-soft">
      <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <PageHeader
          title={t("public.title")}
          description={t("public.subtitle")}
        />

        <BlogFilters
          search={search}
          tag={tag}
          view={view}
          onFiltersChange={(searchValue, tagValue) =>
            patchParams({ q: searchValue, tag: tagValue })
          }
          onViewChange={(value) => patchParams({ view: value })}
        />

        {query.isPending ? (
          <div
            className={
              view === "cards"
                ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                : "space-y-4"
            }
            aria-label={t("public.loading")}
          >
            {Array.from({ length: view === "cards" ? 6 : 4 }, (_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-2xl border border-border bg-card p-4"
              >
                <Skeleton className="aspect-[16/9] w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : query.error ? (
          <ErrorRetry onRetry={() => void query.refetch()} />
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card card-elevated">
            <EmptyState
              Icon={FileText}
              title={
                search || tag ? t("public.filteredEmpty") : t("public.empty")
              }
              action={
                search || tag ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                  >
                    {t("filters.clear")}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div
              className={
                view === "cards"
                  ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                  : "space-y-4"
              }
              aria-live="polite"
            >
              {posts.map((post) =>
                view === "cards" ? (
                  <BlogCard key={post.id} post={post} />
                ) : (
                  <BlogListRow key={post.id} post={post} />
                ),
              )}
            </div>

            <AppPagination
              page={page}
              pages={query.data?.pages ?? 1}
              onPageChange={(nextPage) =>
                patchParams({ page: nextPage === 1 ? undefined : nextPage })
              }
              className="pt-2"
            />
          </>
        )}
      </main>
    </div>
  );
}

export default BlogListPage;
