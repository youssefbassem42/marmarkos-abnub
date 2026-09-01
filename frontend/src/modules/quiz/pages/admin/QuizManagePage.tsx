import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Edit,
  Eye,
  Send,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuiz } from "../../hooks/useQuiz";
import { useQuizByVerse } from "../../hooks/useQuizByVerse";
import { usePublishQuiz } from "../../hooks/usePublishQuiz";
import { useQuizValidation } from "../../hooks/useQuizValidation";
import { QuizOverviewCard } from "../../components/admin/QuizOverviewCard";
import { QuestionTable } from "../../components/admin/QuestionTable";
import { QuizValidationPanel } from "../../components/admin/QuizValidationPanel";
import { QuizAnalyticsTeaser } from "../../components/admin/QuizAnalyticsTeaser";

export default function QuizManagePage() {
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const { t: tAdmin } = useTranslation("admin");
  const navigate = useNavigate();
  const { quizId: routeQuizId } = useParams<{ quizId?: string }>();
  const [searchParams] = useSearchParams();

  const verseIdParam = searchParams.get("verseId");
  const quizIdParam = searchParams.get("quizId");

  const effectiveQuizId = routeQuizId ?? quizIdParam ?? undefined;
  const effectiveVerseId = verseIdParam ?? undefined;

  const quizById = useQuiz(effectiveQuizId ?? "");
  const quizByVerse = useQuizByVerse(effectiveVerseId ?? "");

  const quiz = effectiveQuizId ? quizById.data : quizByVerse.data;
  const isLoading = effectiveQuizId ? quizById.isLoading : quizByVerse.isLoading;
  const error = effectiveQuizId ? quizById.error : quizByVerse.error;

  const resolvedQuizId = quiz?.id;

  const { data: validation } = useQuizValidation(resolvedQuizId ?? "");

  const publishQuiz = usePublishQuiz();

  const handlePublish = () => {
    if (!resolvedQuizId) return;
    publishQuiz.mutate(resolvedQuizId, {
      onSuccess: () => {
        toast.success(t("admin.manage.publishedToast"));
        navigate("/admin/quizzes");
      },
      onError: () => {
        toast.error(t("admin.manage.publishError"));
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-muted-foreground">{tCommon("errors.unknown")}</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/admin/quizzes">{t("admin.builder.backToList")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin/bible-verses">
                {tAdmin("nav.bibleVerses")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                to={`/admin/bible-verses/${quiz.verse_id}/edit`}
              >
                {quiz.verse_reference}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{t("admin.manage.title")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("admin.manage.title")}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/quizzes">
              <ArrowLeft className="me-1 h-4 w-4" />
              {t("admin.manage.backToVerse")}
            </Link>
          </Button>
          <Button variant="outline" size="sm">
            <Eye className="me-1 h-4 w-4" />
            {t("admin.manage.previewButton")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/quizzes/${resolvedQuizId}/builder`}>
              <Edit className="me-1 h-4 w-4" />
              {t("admin.manage.editButton")}
            </Link>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={
                      !validation?.ready || publishQuiz.isPending
                    }
                  >
                    <Send className="me-1 h-4 w-4" />
                    {publishQuiz.isPending
                      ? "..."
                      : t("admin.manage.publishButton")}
                  </Button>
                </span>
              </TooltipTrigger>
              {validation && !validation.ready && (
                <TooltipContent>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t("admin.manage.publishDisabledTooltip")}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <QuizOverviewCard quiz={quiz} />
          <QuestionTable
            quizId={resolvedQuizId ?? quiz.id}
            questions={quiz.questions}
          />
        </div>
        <div className="space-y-6">
          <QuizValidationPanel quizId={resolvedQuizId ?? quiz.id} />
          <QuizAnalyticsTeaser quizId={resolvedQuizId ?? quiz.id} />
        </div>
      </div>
    </div>
  );
}
