import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronRight, ArrowLeft, Save, Eye } from "lucide-react";

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
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuiz } from "../../hooks/useQuiz";
import { useSaveQuestion } from "../../hooks/useSaveQuestion";
import {
  questionSchema,
  type QuestionFormValues,
} from "../../components/admin/questionSchema";
import { QuestionForm } from "../../components/admin/QuestionForm";
import { QuestionPreview } from "../../components/admin/QuestionPreview";
import { QuestionValidationPanel } from "../../components/admin/QuestionValidationPanel";

export default function QuestionFormPage() {
  const { quizId, questionId } = useParams<{
    quizId: string;
    questionId?: string;
  }>();
  const isEdit = !!questionId;
  const { t } = useTranslation("quiz");
  const { t: tAdmin } = useTranslation("admin");
  const navigate = useNavigate();

  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId ?? "");

  const existingQuestion = useMemo(() => {
    if (!quiz?.questions || !questionId) return null;
    return quiz.questions.find((q) => q.id === questionId) ?? null;
  }, [quiz?.questions, questionId]);

  const saveQuestion = useSaveQuestion();

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(
      questionSchema({
        questionRequired: t("admin.question.questionRequired"),
        questionMax: t("admin.question.questionMax"),
        pointsRequired: t("admin.question.pointsRequired"),
        pointsMin: t("admin.question.pointsRange"),
        pointsMax: t("admin.question.pointsRange"),
        optionsMin: t("admin.question.minOptions"),
        optionsMax: t("admin.question.maxOptions"),
        optionTextRequired: t("admin.question.optionTextRequired"),
        correctRequired: t("admin.question.correctRequired"),
      }),
    ),
    defaultValues: {
      question: "",
      points: 1,
      options: [
        { optionText: "", isCorrect: true },
        { optionText: "", isCorrect: false },
      ],
    },
  });

  useEffect(() => {
    if (existingQuestion) {
      form.reset({
        question: existingQuestion.question,
        points: existingQuestion.points,
        options: existingQuestion.options.map((o) => ({
          optionText: o.option_text,
          isCorrect: o.is_correct,
        })),
      });
    }
  }, [existingQuestion, form]);

  const watchedQuestion = form.watch("question") ?? "";
  const watchedOptions = form.watch("options");

  const handleSave = form.handleSubmit((values) => {
    if (!quizId) return;

    saveQuestion.mutate(
      {
        quizId,
        data: {
          question: values.question,
          points: values.points,
          options: values.options.map((o) => ({
            option_text: o.optionText,
            is_correct: o.isCorrect,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(t("admin.question.savedToast"));
          navigate(`/admin/quizzes/${quizId}/manage`);
        },
        onError: () => {
          toast.error(t("admin.question.saveError"));
        },
      },
    );
  });

  if (quizLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ar" className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin/quizzes">{tAdmin("nav.quizzes")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/admin/quizzes/${quizId}/manage`}>
                {quiz?.title ?? quizId}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>
              {isEdit
                ? t("admin.question.editTitle")
                : t("admin.question.newTitle")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit
            ? t("admin.question.editTitle")
            : t("admin.question.newTitle")}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/quizzes/${quizId}/manage`}>
              <ArrowLeft className="me-1 h-4 w-4" />
              {t("admin.question.backToQuiz")}
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveQuestion.isPending}
          >
            <Save className="me-1 h-4 w-4" />
            {saveQuestion.isPending
              ? t("admin.question.savingButton")
              : t("admin.question.saveButton")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {t("admin.question.questionField")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <QuestionForm form={form} />
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <QuestionPreview
            question={watchedQuestion}
            options={watchedOptions}
          />
          <QuestionValidationPanel
            question={watchedQuestion}
            options={watchedOptions}
          />
        </div>
      </div>
    </div>
  );
}
