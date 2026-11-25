import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, Pencil, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BlogPostSummary } from "../types";

interface BlogPostManagementProps {
  post: BlogPostSummary;
  disabled?: boolean;
  onPublish: (post: BlogPostSummary) => void;
  onSchedule: (post: BlogPostSummary) => void;
  onArchive: (post: BlogPostSummary) => void;
}

/** The state badge and the management actions of a post. */
export function BlogPostManagement({
  post,
  disabled = false,
  onPublish,
  onSchedule,
  onArchive,
}: BlogPostManagementProps) {
  const { t } = useTranslation("blog");
  const status = post.status.toLowerCase();
  const isDraft = post.status === "DRAFT";

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            post.status === "PUBLISHED"
              ? "default"
              : post.status === "DRAFT"
                ? "secondary"
                : "outline"
          }
        >
          {t(`admin.status.${status}` as "admin.status.draft")}
        </Badge>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("admin.actions.groupLabel")}
      >
        <Button asChild variant="outline" size="sm" disabled={disabled}>
          <Link to={`/blog/${post.id}/edit`}>
            <Pencil className="me-1 h-4 w-4" aria-hidden="true" />
            {t("admin.actions.edit")}
          </Link>
        </Button>
        {isDraft ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onPublish(post)}
            >
              <Send className="me-1 h-4 w-4" aria-hidden="true" />
              {t("admin.actions.publish")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSchedule(post)}
            >
              <CalendarClock className="me-1 h-4 w-4" aria-hidden="true" />
              {t("admin.actions.schedule")}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={() => onArchive(post)}
        >
          <Trash2 className="me-1 h-4 w-4" aria-hidden="true" />
          {t("admin.actions.archive")}
        </Button>
      </div>
    </div>
  );
}
