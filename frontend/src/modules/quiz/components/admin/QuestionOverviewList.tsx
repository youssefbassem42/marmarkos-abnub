import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteQuestion } from "../../hooks/useDeleteQuestion";
import { useDuplicateQuestion } from "../../hooks/useDuplicateQuestion";
import type { QuizQuestionResponse } from "../../types";

interface QuestionOverviewListProps {
  quizId: string;
  questions: QuizQuestionResponse[];
  isLoading?: boolean;
}

export function QuestionOverviewList({
  quizId,
  questions,
  isLoading,
}: QuestionOverviewListProps) {
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteQuestion = useDeleteQuestion();
  const duplicateQuestion = useDuplicateQuestion();

  const sorted = [...questions].sort((a, b) => a.position - b.position);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteQuestion.mutate(
      { quizId, questionId: deleteId },
      {
        onSuccess: () => {
          toast.success(t("admin.builder.deleteSuccess"));
          setDeleteId(null);
        },
        onError: () => {
          toast.error(tCommon("errors.unknown"));
        },
      },
    );
  }, [deleteId, quizId, deleteQuestion, t]);

  const handleDuplicate = useCallback(
    (questionId: string) => {
      duplicateQuestion.mutate(
        { quizId, questionId },
        {
          onSuccess: () => {
            toast.success(t("admin.builder.duplicateSuccess"));
          },
          onError: () => {
            toast.error(tCommon("errors.unknown"));
          },
        },
      );
    },
    [quizId, duplicateQuestion, t],
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {t("admin.question.options")} ({sorted.length})
        </CardTitle>
        <Button size="sm" asChild>
          <Link to={`/admin/quizzes/${quizId}/questions/new`}>
            <Plus className="me-1 h-4 w-4" />
            {t("admin.builder.addQuestion")}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("admin.manage.noQuestions")}
          </p>
        )}
        {sorted.map((q, index) => (
          <div
            key={q.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{q.question}</p>
              <p className="text-xs text-muted-foreground">
                {q.points} {t("admin.question.points").toLowerCase()} ·{" "}
                {q.options.length}{" "}
                {t("admin.question.options").toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link
                  to={`/admin/quizzes/${quizId}/questions/${q.id}/edit`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDuplicate(q.id)}
                disabled={duplicateQuestion.isPending}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setDeleteId(q.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.builder.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.builder.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteQuestion.isPending}
            >
              {deleteQuestion.isPending ? "..." : tCommon("back")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
