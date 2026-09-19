import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
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
  Info,
  ExternalLink,
  FileQuestion,
  Plus,
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
import { AdminTopbar } from "@/components/layout/AdminTopbar";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useQuiz } from "../../hooks/useQuiz";
import { useCreateQuiz } from "../../hooks/useCreateQuiz";
import { useUpdateQuiz } from "../../hooks/useUpdateQuiz";
import { usePublishQuiz } from "../../hooks/usePublishQuiz";
import { useQuizValidation } from "../../hooks/useQuizValidation";
import { useQuizByVerse } from "../../hooks/useQuizByVerse";
import { useVerse } from "@/modules/bible/hooks/useVerse";
import { quizSchema, type QuizFormValues } from "../../components/admin/quizSchema";
import { QuizInfoForm } from "../../components/admin/QuizInfoForm";
import { QuizSettingsForm } from "../../components/admin/QuizSettingsForm";
import { VersePickerField } from "../../components/admin/VersePickerField";
import { QuestionOverviewList } from "../../components/admin/QuestionOverviewList";
import { QuizReadinessPanel } from "../../components/admin/QuizReadinessPanel";
import { BuilderQuestionEditor } from "../../components/admin/BuilderQuestionEditor";
import { useReorderQuestions } from "../../hooks/useReorderQuestions";
import type { QuizQuestionResponse } from "../../types";

type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export default function QuizBuilderPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const isEdit = !!quizId;
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const { t: tBible } = useTranslation("bible");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [quizStatus, setQuizStatus] = useState<QuizStatus>("DRAFT");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<QuizQuestionResponse | null>(null);
  const autoOpenHandled = useRef(false);

  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId ?? "");
  const { data: verse } = useVerse(quiz?.verse_id ?? "", {
    enabled: !!quiz?.verse_id,
  });

  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const publishQuiz = usePublishQuiz();
  const reorderQuestions = useReorderQuestions();

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
      setQuizStatus(quiz.status as QuizStatus);
    }
  }, [quiz, form]);

  const selectedVerseId = form.watch("verseId");
  const { data: pickedVerse } = useVerse(selectedVerseId ?? "", {
    enabled: !isEdit && !!selectedVerseId,
  });
  const existingQuiz = useQuizByVerse(isEdit ? "" : (selectedVerseId ?? ""));

  useEffect(() => {
    const preset = searchParams.get("verseId");
    if (!isEdit && preset && !form.getValues("verseId")) {
      form.setValue("verseId", preset);
    }
  }, [searchParams, isEdit, form]);

  useEffect(() => {
    if (autoOpenHandled.current) return;
    const state = location.state as { openQuestionEditor?: boolean } | null;
    if (isEdit && quizId && state?.openQuestionEditor) {
      autoOpenHandled.current = true;
      setEditingQuestion(null);
      setEditorOpen(true);
    }
  }, [location.state, isEdit, quizId]);

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

  const handleCreateAndAddQuestion = form.handleSubmit((values) => {
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
          navigate(`/admin/quizzes/${created.id}/builder`, {
            replace: true,
            state: { openQuestionEditor: true },
          });
        },
        onError: () => {
          toast.error(t("admin.builder.saveError"));
        },
      },
    );
  });

  const openCreateEditor = () => {
    setEditingQuestion(null);
    setEditorOpen(true);
  };

  const openEditEditor = (question: QuizQuestionResponse) => {
    setEditingQuestion(question);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingQuestion(null);
    setEditorOpen(false);
  };

  const persistReorder = (ids: string[]) => {
    if (!quizId) return;
    reorderQuestions.mutate(
      { quizId, data: { question_ids: ids } },
      {
        onSuccess: () => {
          toast.success(t("admin.manage.reorderSuccess"));
        },
        onError: () => {
          toast.error(t("admin.manage.reorderError"));
        },
      },
    );
  };

  const handleMoveUp = (questionId: string) => {
    if (!quizId) return;
    const sortedIds = [...(quiz?.questions ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((q) => q.id);
    const index = sortedIds.indexOf(questionId);
    if (index <= 0) return;
    const next = [...sortedIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persistReorder(next);
  };

  const handleMoveDown = (questionId: string) => {
    if (!quizId) return;
    const sortedIds = [...(quiz?.questions ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((q) => q.id);
    const index = sortedIds.indexOf(questionId);
    if (index === -1 || index === sortedIds.length - 1) return;
    const next = [...sortedIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persistReorder(next);
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

  const ActionBar = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        size="sm"
        onClick={handleSaveDraft}
        disabled={createQuiz.isPending || updateQuiz.isPending}
        variant="outline"
      >
        <Save className="me-1 h-4 w-4" />
        {createQuiz.isPending || updateQuiz.isPending
          ? t("admin.builder.saving")
          : t("admin.builder.saveDraft")}
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
                    disabled={!validation?.ready || publishQuiz.isPending}
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
    </div>
  );

  return (
    <div dir="rtl" lang="ar">
      <AdminTopbar
        title={isEdit ? t("admin.builder.editTitle") : t("admin.builder.newTitle")}
        subtitle={t("admin.manage.subtitle")}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-6 lg:px-8">
        {/* Top bar: title + actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/quizzes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-arabic">
                {isEdit
                  ? t("admin.builder.editTitle")
                  : t("admin.builder.newTitle")}
              </h1>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/admin/bible-verses">
                        {tBible("admin.title")}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-arabic">
                      {isEdit
                        ? t("admin.builder.editTitle")
                        : t("admin.builder.newTitle")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
          <ActionBar />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content — 2/3 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 1. معلومات الاختبار */}
            <Card>
              <CardHeader>
                <CardTitle className="font-arabic">
                  1. {t("admin.builder.titleField")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <QuizInfoForm
                    form={form}
                    verseId={quiz?.verse_id ?? form.watch("verseId")}
                    isEdit={isEdit}
                  />
                </Form>
              </CardContent>
            </Card>

            {/* 2. إعدادات الاختبار */}
            <Card>
              <CardHeader>
                <CardTitle className="font-arabic">
                  2. {t("admin.builder.durationField")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <QuizSettingsForm form={form} totalPoints={totalPoints} />
                </Form>
              </CardContent>
            </Card>

            {/* 3. الآية المرتبطة */}
            <Card>
              <CardHeader>
                <CardTitle className="font-arabic">
                  3. {t("admin.builder.relatedVerse")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEdit && (
                  <>
                    <VersePickerField
                      value={selectedVerseId}
                      onValueChange={(verseId) =>
                        form.setValue("verseId", verseId)
                      }
                    />
                    {existingQuiz.data && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="min-w-0 text-sm font-arabic">
                          <p className="text-amber-800 dark:text-amber-300">
                            {t("admin.builder.verseHasQuiz", {
                              title: existingQuiz.data.title,
                            })}
                          </p>
                          <Link
                            to={`/admin/quizzes/${existingQuiz.data.id}/builder`}
                            className="mt-1 inline-flex items-center gap-1 text-brand-blue hover:underline"
                          >
                            {t("admin.builder.viewExistingQuiz")}
                            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {(isEdit ? verse : pickedVerse) && (
                  <div className="flex items-start gap-4">
                    {(isEdit ? verse : pickedVerse)?.image && (
                      <img
                        src={(isEdit ? verse : pickedVerse)?.image ?? ""}
                        alt={(isEdit ? verse : pickedVerse)?.title ?? ""}
                        className="h-24 w-24 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold font-arabic">
                        {(isEdit ? verse : pickedVerse)?.verse_reference}
                      </p>
                      <p className="text-sm text-muted-foreground font-arabic">
                        {(isEdit ? verse : pickedVerse)?.title}
                      </p>
                      {(isEdit ? verse : pickedVerse)?.text && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 font-arabic">
                          {(isEdit ? verse : pickedVerse)?.text}
                        </p>
                      )}
                      <Link
                        to={`/admin/bible-verses/${
                          (isEdit ? verse : pickedVerse)?.id
                        }/edit`}
                        className="mt-2 inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t("admin.manage.viewVerse")}
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. حالة الاختبار */}
            <Card>
              <CardHeader>
                <CardTitle className="font-arabic">
                  4. {t("admin.manage.status")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={quizStatus}
                  onValueChange={(v) => setQuizStatus(v as QuizStatus)}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <RadioGroupItem value="DRAFT" id="status-draft" />
                    <Label htmlFor="status-draft" className="cursor-pointer flex-1">
                      <span className="font-medium font-arabic">{t("admin.manage.draftBadge")}</span>
                      <p className="text-xs text-muted-foreground font-arabic">مرجع للمسؤولين فقط.</p>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <RadioGroupItem value="PUBLISHED" id="status-published" />
                    <Label htmlFor="status-published" className="cursor-pointer flex-1">
                      <span className="font-medium font-arabic">{t("admin.manage.publishedBadge")}</span>
                      <p className="text-xs text-muted-foreground font-arabic">متاح لجميع المستخدمين.</p>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <RadioGroupItem value="ARCHIVED" id="status-archived" />
                    <Label htmlFor="status-archived" className="cursor-pointer flex-1">
                      <span className="font-medium font-arabic">{t("admin.manage.archivedBadge")}</span>
                      <p className="text-xs text-muted-foreground font-arabic">مخفى عن المستخدمين.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* 5. نظرة عامة على الأسئلة */}
            {isEdit && quizId ? (
              <>
                {editorOpen && (
                  <BuilderQuestionEditor
                    quizId={quizId}
                    editing={editingQuestion}
                    onClose={closeEditor}
                    onSaved={closeEditor}
                  />
                )}
                <QuestionOverviewList
                  quizId={quizId}
                  questions={quiz?.questions ?? []}
                  onAdd={openCreateEditor}
                  onEdit={openEditEditor}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  movePending={reorderQuestions.isPending}
                />
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="font-arabic">
                    5. {t("admin.question.options")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <FileQuestion className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-ink font-arabic">
                      {t("admin.builder.noQuestionsYet")}
                    </p>
                    <p className="text-xs text-muted-foreground font-arabic">
                      {t("admin.builder.addFirstQuestionHint")}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => void handleCreateAndAddQuestion()}
                      disabled={createQuiz.isPending}
                    >
                      <Plus className="me-1 h-4 w-4" />
                      {createQuiz.isPending
                        ? t("admin.builder.creatingDraft")
                        : t("admin.builder.addFirstQuestion")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar — 1/3 */}
          <div className="space-y-6">
            {isEdit && quizId && <QuizReadinessPanel quizId={quizId} />}
          </div>
        </div>

        {/* Auto-save note */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-brand-blue" />
          <span className="font-arabic">{t("admin.builder.autoSaveNote")}</span>
        </div>
      </main>

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-background p-4 md:hidden z-40">
        <ActionBar className="justify-center" />
      </div>
    </div>
  );
}
