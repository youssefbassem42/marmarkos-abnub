import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hasAnyRole } from "@/lib/auth";
import { BlogCard } from "../../components/BlogCard";
import { BlogFilters, type BlogView } from "../../components/BlogFilters";
import { BlogListRow } from "../../components/BlogListRow";
import { BlogPostManagement } from "../../components/BlogPostManagement";
import {
  useBlogPosts,
  useDeleteBlogPost,
  usePublishBlogPost,
  useScheduleBlogPost,
} from "../../hooks";
import type {
  BlogPostStatus,
  BlogPostSummary,
  BlogPostsListParams,
} from "../../types";

const PAGE_SIZE = 12;

/** The blog feed and the management actions of the staff. */
export function BlogListPage() {
  const { t } = useTranslation("blog");
  const { t: tCommon } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [postToArchive, setPostToArchive] = useState<BlogPostSummary | null>(
    null,
  );
  const canManage = hasAnyRole("ADMIN", "SERVANT");

  const search = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const view: BlogView = searchParams.get("view") === "list" ? "list" : "cards";
  // The lifecycle filter belongs to the staff: a member never widens
  // his view with it (BR-89).
  const status = canManage ? (searchParams.get("status") ?? "") : "";

  const apiParams = useMemo<BlogPostsListParams>(
    () => ({
      page,
      size: PAGE_SIZE,
      ...(search ? { q: search } : {}),
      ...(tag ? { tag } : {}),
      ...(status ? { status: status as BlogPostStatus } : {}),
    }),
    [page, search, tag, status],
  );
  const query = useBlogPosts(apiParams);
  const publishPost = usePublishBlogPost();
  const schedulePost = useScheduleBlogPost();
  const deletePost = useDeleteBlogPost();
  const isBusy =
    publishPost.isPending || schedulePost.isPending || deletePost.isPending;

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

  const handlePublish = (post: BlogPostSummary) => {
    publishPost.mutate(post.id, {
      onSuccess: () => toast.success(t("admin.published")),
      onError: () => toast.error(t("admin.failed")),
    });
  };

  const handleSchedule = (post: BlogPostSummary) => {
    const publishedAt = post.published_at
      ? new Date(post.published_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    schedulePost.mutate(
      { postId: post.id, data: { published_at: publishedAt.toISOString() } },
      {
        onSuccess: () => toast.success(t("admin.scheduled")),
        onError: () => toast.error(t("admin.failed")),
      },
    );
  };

  const handleArchive = () => {
    if (!postToArchive) return;
    deletePost.mutate(postToArchive.id, {
      onSuccess: () => {
        toast.success(t("admin.archived"));
        setPostToArchive(null);
      },
      onError: () => toast.error(t("admin.failed")),
    });
  };

  const management = (post: BlogPostSummary) =>
    canManage ? (
      <BlogPostManagement
        post={post}
        disabled={isBusy}
        onPublish={handlePublish}
        onSchedule={handleSchedule}
        onArchive={setPostToArchive}
      />
    ) : undefined;

  return (
    <div className="min-h-screen bg-soft">
      <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <PageHeader
          title={t("public.title")}
          description={t("public.subtitle")}
          actions={
            canManage ? (
              <Button asChild className="btn-primary">
                <Link to="/blog/new">
                  <Plus className="me-1 h-4 w-4" aria-hidden="true" />
                  {t("management.writePost")}
                </Link>
              </Button>
            ) : undefined
          }
        />

        <BlogFilters
          search={search}
          tag={tag}
          view={view}
          status={status}
          canFilterByStatus={canManage}
          onStatusChange={(value) => patchParams({ status: value, page: 1 })}
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
                  <BlogCard
                    key={post.id}
                    post={post}
                    management={management(post)}
                  />
                ) : (
                  <BlogListRow
                    key={post.id}
                    post={post}
                    management={management(post)}
                  />
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

      <AlertDialog
        open={postToArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPostToArchive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.archiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.archiveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              {t("admin.actions.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BlogListPage;
