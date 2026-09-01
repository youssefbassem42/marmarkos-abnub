import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Clock,
  Trophy,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuizSummary } from "../types";

interface QuizTeaserCardProps {
  quiz: QuizSummary;
  isRead: boolean;
  attemptStatus?: "IN_PROGRESS" | "COMPLETED" | "AUTO_FINISHED" | null;
}

export function QuizTeaserCard({
  quiz,
  isRead,
  attemptStatus,
}: QuizTeaserCardProps) {
  const { t } = useTranslation("bible");
  const durationMinutes = Math.ceil(quiz.duration_seconds / 60);

  const inProgress = attemptStatus === "IN_PROGRESS";
  const completed =
    attemptStatus === "COMPLETED" || attemptStatus === "AUTO_FINISHED";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 card-elevated md:p-6">
      <div className="flex items-start justify-between">
        <h3
          className="text-base font-bold text-ink font-arabic text-lg"
        >
          {t("quizCard.title")}
        </h3>
        {completed && (
          <Badge variant="secondary">{t("quizCard.completed")}</Badge>
        )}
      </div>
      <p
        className="mt-1 text-sm text-muted-foreground font-arabic text-base"
      >
        {t("quizCard.body")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {t("quizCard.questions", { count: quiz.question_count })}
        </span>
        <span className="flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {t("quizCard.points", { count: quiz.total_points })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("quizCard.timeLimit", { minutes: durationMinutes })}
        </span>
      </div>

      <div className="mt-4">
        {!isRead ? (
          <div className="space-y-2">
            <Button disabled className="w-full">
              <Lock className="h-4 w-4" aria-hidden="true" />
              {t("quizCard.locked")}
            </Button>
            <p
              className="text-center text-xs text-muted-foreground font-arabic"
            >
              {t("quizCard.lockedHint")}
            </p>
          </div>
        ) : inProgress ? (
          <Button asChild className="w-full">
            <Link to={`/quizzes/${quiz.id}/take`}>
              {t("quizCard.start")}
              <ArrowRight
                className="h-4 w-4 rtl:hidden"
                aria-hidden="true"
              />
              <ArrowRight
                className="hidden h-4 w-4 rotate-180 rtl:block"
                aria-hidden="true"
              />
            </Link>
          </Button>
        ) : completed ? (
          <Button asChild variant="outline" className="w-full">
            <Link to={`/quizzes/${quiz.id}/result`}>
              {t("quizCard.viewResult")}
              <ArrowRight
                className="h-4 w-4 rtl:hidden"
                aria-hidden="true"
              />
              <ArrowRight
                className="hidden h-4 w-4 rotate-180 rtl:block"
                aria-hidden="true"
              />
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to={`/quizzes/${quiz.id}/take`}>
              {t("quizCard.start")}
              <ArrowRight
                className="h-4 w-4 rtl:hidden"
                aria-hidden="true"
              />
              <ArrowRight
                className="hidden h-4 w-4 rotate-180 rtl:block"
                aria-hidden="true"
              />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
