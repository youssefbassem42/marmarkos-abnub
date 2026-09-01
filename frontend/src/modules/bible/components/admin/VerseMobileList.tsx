import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/datetime";
import { VerseRowActions } from "./VerseRowActions";
import type { VerseAdminItem } from "../../types";

interface VerseMobileListProps {
  items: VerseAdminItem[];
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ARCHIVED: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function VerseMobileList({ items }: VerseMobileListProps) {
  const { t, i18n } = useTranslation("bible");
  const locale = i18n.language;

  return (
    <div className="divide-y divide-border">
      {items.map((verse) => (
        <div key={verse.id} className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/admin/bible-verses/${verse.id}/edit`}
                className="truncate font-medium text-foreground underline-offset-4 hover:underline"
              >
                {verse.title}
              </Link>
              <Badge
                variant="outline"
                className={STATUS_BADGE_CLASS[verse.status] ?? ""}
              >
                {t(`admin.statuses.${verse.status}`)}
              </Badge>
            </div>
            {verse.subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {verse.subtitle}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRelativeDate(verse.created_at, locale)}
            </p>
          </div>
          <VerseRowActions verse={verse} />
        </div>
      ))}
    </div>
  );
}
