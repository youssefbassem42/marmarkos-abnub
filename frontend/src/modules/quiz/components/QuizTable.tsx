import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { QuizAdminItem, QuizStatus } from "../types";

interface QuizTableProps {
  items: QuizAdminItem[];
  isPending: boolean;
}

const STATUS_STYLES: Record<QuizStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ARCHIVED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function QuizTable({ items, isPending }: QuizTableProps) {
  const { t } = useTranslation("quiz");

  const STATUS_LABELS: Record<QuizStatus, string> = {
    DRAFT: t("admin.list.statuses.DRAFT"),
    PUBLISHED: t("admin.list.statuses.PUBLISHED"),
    ARCHIVED: t("admin.list.statuses.ARCHIVED"),
  };

  if (isPending) {
    return (
      <div className="space-y-2 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        {t("admin.list.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto p-1 sm:p-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.list.colTitle")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("admin.list.colVerse")}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {t("admin.list.colQuestions")}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {t("admin.list.colPoints")}
            </TableHead>
            <TableHead className="hidden lg:table-cell">
              {t("admin.list.colDuration")}
            </TableHead>
            <TableHead>{t("admin.list.colStatus")}</TableHead>
            <TableHead className="text-end">{t("admin.list.colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((quiz) => (
            <TableRow
              key={quiz.id}
              className="cursor-pointer"
              // Row click navigates to builder — handled via Link on the title
            >
              <TableCell>
                <Link
                  to={`/admin/quizzes/${quiz.id}/builder`}
                  className="font-medium text-ink hover:underline font-arabic"
                >
                  {quiz.title}
                </Link>
              </TableCell>
              <TableCell
                className="hidden text-muted-foreground sm:table-cell font-arabic"
              >
                {quiz.verse_reference}
              </TableCell>
              <TableCell className="hidden md:table-cell" dir="ltr" tabular-nums>
                {quiz.question_count}
              </TableCell>
              <TableCell className="hidden md:table-cell" dir="ltr" tabular-nums>
                {quiz.total_points}
              </TableCell>
              <TableCell className="hidden lg:table-cell" dir="ltr" tabular-nums>
                {formatClock(quiz.duration_seconds)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("text-xs", STATUS_STYLES[quiz.status])}
                >
                  {STATUS_LABELS[quiz.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-end">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to={`/admin/quizzes/${quiz.id}/builder`}>
                      {t("admin.list.edit")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to="/admin/analytics/quizzes">
                      {t("admin.list.analytics")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to={`/admin/quizzes/${quiz.id}/questions/new`}>
                      <Plus className="me-1 h-3.5 w-3.5" />
                      {t("admin.list.addQuestion")}
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
