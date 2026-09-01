import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ChevronRight,
  ArrowLeft,
  Save,
  Eye,
  Send,
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuiz } from "../../hooks/useQuiz";
import { useCreateQuiz } from "../../hooks/useCreateQuiz";
import { useUpdateQuiz } from "../../hooks/useUpdateQuiz";
import { usePublishQuiz } from "../../hooks/usePublishQuiz";
import { useQuizValidation } from "../../hooks/useQuizValidation";
import { quizSchema, type QuizFormValues } from "../../components/admin/quizSchema";
import { QuizInfoForm } from "../../components/admin/QuizInfoForm";
import { QuizSettingsForm } from "../../components/admin/QuizSettingsForm";
import { QuestionOverviewList } from "../../components/admin/QuestionOverviewList";
import { QuizReadinessPanel } from "../../components/admin/QuizReadinessPanel";

export default function QuizBuilderPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const isEdit = !!quizId;
  const { t } = useTranslation("quiz");
  const { t: tAdmin } = useTranslation("admin");
  const navigate = useNavigate();

  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId ?? "");

  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const publishQuiz = usePublishQuiz();

  const totalPoints = useMemo(() => {
    if (!quiz?.questions) return 0;
    return quiz.questions.reduce((sum, q) => sum + q.points, 0);
  }, [quiz?.questions]);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(
      quizSchema({
        titleRequired: t("admin.question.questionRequired"),
        titleMax: t("admin.question.pointsRange"),
        descriptionMax: t("admin.question.pointsRange"),
        verseIdRequired: t("admin.question.questionRequired"),
        durationRequired: t("admin.question.pointsRequired"),
        durationMin: t("admin.question.pointsRange"),
        durationMax: t("admin.question.pointsRange"),
      }),
    ),
    defaultValues: {
      title: "",
      description: "",
      verseId: quizId ? "" : "",
      durationSeconds: 300,
    },
  });

  useEffect(() => {
    if (quiz) {
      form.reset({
        title: quiz.title,
        description: quiz.description ?? "",
        verseId: quiz.verse_id,
        durationSeconds: quiz.duration_seconds,
      });
    }
  }, [quiz, form]);

  const { data: validation } = useQuizValidation(quizId ?? "");

  const handleSaveDraft = form.handleSubmit((values) => {
    if (isEdit && quizId) {
      updateQuiz.mutate(
        {
          quizId,
          data: {
            title: values.title,
            description: values.description,
            duration_seconds: values.durationSeconds,
          },
        },
        {
          onSuccess: () => {
            toast.success(t("admin.builder.savedToast"));
          },
          onError: () => {
            toast.error(t("admin.builder.saveError"));
          },
        },
      );
    } else {
      createQuiz.mutate(
        {
          title: values.title,
          description: values.description,
          verse_id: values.verseId,
          duration_seconds: values.durationSeconds,
        },
        {
          onSuccess: (created) => {
            toast.success(t("admin.builder.savedToast"));
            navigate(`/admin/quizzes/${created.id}/builder`, { replace: true });
          },
          onError: () => {
            toast.error(t("admin.builder.saveError"));
          },
        },
      );
    }
  });

  const handlePublish = () => {
    if (!quizId) return;
    publishQuiz.mutate(quizId, {
      onSuccess: () => {
        toast.success(t("admin.builder.publishedToast"));
        navigate("/admin/quizzes");
      },
      onError: () => {
        toast.error(t("admin.builder.publishError"));
      },
    });
  };

  if (quizLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-5 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin/quizzes">
                {tAdmin("nav.quizzes")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>
              {isEdit
                ? t("admin.builder.editTitle")
                : t("admin.builder.newTitle")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit
            ? t("admin.builder.editTitle")
            : t("admin.builder.newTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/quizzes">
              <ArrowLeft className="me-1 h-4 w-4" />
              {t("admin.builder.backToList")}
            </Link>
          </Button>
          {isEdit && (
            <>
              <Button variant="outline" size="sm">
                <Eye className="me-1 h-4 w-4" />
                {t("admin.builder.previewButton")}
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
                          : t("admin.builder.publishButton")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {validation && !validation.ready && (
                    <TooltipContent>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t("admin.builder.publishDisabledTooltip")}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <Button
            size="sm"
            onClick={handleSaveDraft}
            disabled={createQuiz.isPending || updateQuiz.isPending}
          >
            <Save className="me-1 h-4 w-4" />
            {createQuiz.isPending || updateQuiz.isPending
              ? t("admin.builder.saving")
              : t("admin.builder.saveDraft")}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("admin.builder.titleField")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuizInfoForm
                  form={form}
                  verseId={quiz?.verse_id ?? form.watch("verseId")}
                  isEdit={isEdit}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("admin.builder.durationField")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuizSettingsForm form={form} totalPoints={totalPoints} />
              </CardContent>
            </Card>

            {isEdit && quizId && (
              <QuestionOverviewList
                quizId={quizId}
                questions={quiz?.questions ?? []}
              />
            )}
          </div>

          <div>
            {isEdit && quizId && <QuizReadinessPanel quizId={quizId} />}
          </div>
        </div>
      </Form>
    </div>
  );
}
