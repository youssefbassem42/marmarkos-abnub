import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  FileText,
  HelpCircle,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { QuizDetailResponse, QuizStatus } from "../../types";

interface QuizOverviewCardProps {
  quiz: QuizDetailResponse;
  isLoading?: boolean;
}

const STATUS_MAP: Record<
  QuizStatus,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    labelKey:
      | "admin.manage.draftBadge"
      | "admin.manage.publishedBadge"
      | "admin.manage.archivedBadge";
  }
> = {
  DRAFT: { variant: "secondary", labelKey: "admin.manage.draftBadge" },
  PUBLISHED: { variant: "default", labelKey: "admin.manage.publishedBadge" },
  ARCHIVED: { variant: "outline", labelKey: "admin.manage.archivedBadge" },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function QuizOverviewCard({ quiz, isLoading }: QuizOverviewCardProps) {
  const { t } = useTranslation("quiz");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = STATUS_MAP[quiz.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{quiz.title}</CardTitle>
            {quiz.description && (
              <p className="text-sm text-muted-foreground">
                {quiz.description}
              </p>
            )}
          </div>
          <Badge variant={statusInfo.variant} className="shrink-0">
            {t(statusInfo.labelKey)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.manage.questionCount")}
              </p>
              <p className="text-sm font-medium">{quiz.question_count}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.manage.totalPoints")}
              </p>
              <p className="text-sm font-medium">{quiz.total_points}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.manage.duration")}
              </p>
              <p className="text-sm font-medium">
                {formatDuration(quiz.duration_seconds)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t("admin.manage.status")}
              </p>
              <p className="text-sm font-medium capitalize">
                {quiz.status.toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">
              {t("admin.manage.relatedVerse")}
            </p>
            <p className="text-sm font-medium">{quiz.verse_reference}</p>
          </div>
          <Link
            to={`/admin/bible-verses/${quiz.verse_id}/edit`}
            className={cn(
              "text-sm text-primary underline-offset-4 hover:underline",
            )}
          >
            {t("admin.manage.viewVerse")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
