import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

import {
  useAdminBlogPosts,
  useDeleteBlogPost,
  usePublishBlogPost,
} from "../../hooks";
import type { BlogPostAdmin, BlogPostStatus } from "../../types";

const PAGE_SIZE = 20;

/** The badge of the state of a post, with the colour of the platform. */
function StatusBadge({ status }: { status: BlogPostStatus }) {
  const { t } = useTranslation("blog");

  const variant =
    status === "PUBLISHED"
      ? "default"
      : status === "DRAFT"
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant}>
      {t(`admin.status.${status.toLowerCase()}` as "admin.status.draft")}
    </Badge>
  );
}

export function BlogAdminListPage() {
  const { t } = useTranslation("blog");
  const { t: tCommon } = useTranslation("common");

  const [page, setPage] = useState(1);
  const [postToArchive, setPostToArchive] = useState<BlogPostAdmin | null>(
    null,
  );

  const query = useAdminBlogPosts({ page, size: PAGE_SIZE });
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const pages = Math.max(query.data?.pages ?? 1, 1);

  const publishPost = usePublishBlogPost();
  const deletePost = useDeleteBlogPost();
  const isBusy = publishPost.isPending || deletePost.isPending;

  const handlePublish = (post: BlogPostAdmin) => {
    publishPost.mutate(post.id, {
      onSuccess: () => toast.success(t("admin.published")),
      onError: () => toast.error(t("admin.failed")),
    });
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

  return (
    <div className="space-y-6 p-6">
      <AdminTopbar
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        backHref="/admin/dashboard"
        showSidebarTrigger
      />

      <div className="flex justify-end">
        <Button asChild className="btn-primary">
          <Link to="/admin/blog/posts/new">
            <Plus className="me-1 h-4 w-4" aria-hidden="true" />
            {t("admin.newPost")}
          </Link>
        </Button>
      </div>

      {query.isError ? (
        <ErrorRetry onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <div className="space-y-2" data-testid="blog-admin-skeleton">
          <div className="h-12 w-full rounded-2xl bg-muted" />
          <div className="h-12 w-full rounded-2xl bg-muted" />
          <div className="h-12 w-full rounded-2xl bg-muted" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title={t("admin.emptyTitle")}
          action={
            <Button asChild variant="outline">
              <Link to="/admin/blog/posts/new">
                <Plus className="me-1 h-4 w-4" aria-hidden="true" />
                {t("admin.newPost")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="card-elevated overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.table.title")}</TableHead>
                <TableHead>{t("admin.table.status")}</TableHead>
                <TableHead>{t("admin.table.date")}</TableHead>
                <TableHead>{t("admin.table.author")}</TableHead>
                <TableHead className="text-end">
                  {t("admin.table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium text-ink">
                    <span className="flex items-center gap-2">
                      <FileText
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {post.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={post.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {post.published_at ? (
                      <span className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" aria-hidden="true" />
                        {new Date(post.published_at).toLocaleDateString(
                          "ar-EG",
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {post.author.full_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/blog/posts/${post.id}/edit`}>
                          <Pencil className="me-1 h-4 w-4" aria-hidden="true" />
                          {t("admin.actions.edit")}
                        </Link>
                      </Button>
                      {post.status !== "PUBLISHED" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handlePublish(post)}
                        >
                          <Send className="me-1 h-4 w-4" aria-hidden="true" />
                          {t("admin.actions.publish")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setPostToArchive(post)}
                      >
                        <Trash2 className="me-1 h-4 w-4" aria-hidden="true" />
                        {t("admin.actions.archive")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <AppPagination page={page} pages={pages} onPageChange={setPage} />
      )}

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

export default BlogAdminListPage;
