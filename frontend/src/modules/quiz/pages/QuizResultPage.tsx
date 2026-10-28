import { useTranslation } from "react-i18next";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useAttemptResult } from "../hooks/useAttemptResult";
import { ResultHeader } from "../components/ResultHeader";
import { ScoreSummary } from "../components/ScoreSummary";
import { PointsProgressBars } from "../components/PointsProgressBars";
import { QuestionReviewList } from "../components/QuestionReviewList";

export default function QuizResultPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();

  // The id of the attempt comes from the router, not from
  // `window.location`: the router owns the URL, and reading the address
  // of the browser behind its back breaks under a basename (and in the
  // tests).
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get("attemptId") ?? "";

  const {
    data: result,
    isLoading,
    isError,
  } = useAttemptResult(attemptId, {
    enabled: !!attemptId,
  });

  if (!attemptId) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8"
        role="alert"
      >
        <p className="text-destructive">{tCommon("errors.unknown")}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          {tCommon("back")}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError || !result) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8"
        role="alert"
      >
        <p className="text-destructive">{tCommon("errors.unknown")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <ResultHeader />

      <ScoreSummary
        score={result.score}
        totalPoints={result.total_points}
        correctCount={result.correct_count}
        incorrectCount={result.incorrect_count}
      />

      {/* The snapshot of the points (before and after the attempt): the
          server sends the totals of the member, not the score of the
          attempt (the page used to show the score three times). */}
      <PointsProgressBars
        weekPoints={result.points.week_after}
        monthPoints={result.points.month_after}
        lifetimePoints={result.points.lifetime_after}
      />

      {/* The server sends the review of the attempt under `review`
          (the owner of the attempt may read it). */}
      <QuestionReviewList questions={result.review} status={result.status} />

      {/* Bottom navigation */}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button variant="outline" asChild className="flex-1">
          <Link to={quizId ? `/bible-verses/${quizId}` : "/"}>
            <ArrowLeft className="h-4 w-4" />
            {t("result.backToVerse")}
          </Link>
        </Button>
        <Button asChild className="flex-1">
          <Link to="/points">
            <BarChart3 className="h-4 w-4" />
            {t("result.viewPoints")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
