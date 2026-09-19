import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteQuestion } from "../../hooks/useDeleteQuestion";
import { useDuplicateQuestion } from "../../hooks/useDuplicateQuestion";
import type { QuizQuestionResponse } from "../../types";

interface QuestionOverviewListProps {
  quizId: string;
  questions: QuizQuestionResponse[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (question: QuizQuestionResponse) => void;
  onMoveUp: (questionId: string) => void;
  onMoveDown: (questionId: string) => void;
  movePending?: boolean;
}

export function QuestionOverviewList({
  quizId,
  questions,
  isLoading,
  onAdd,
  onEdit,
  onMoveUp,
  onMoveDown,
  movePending,
}: QuestionOverviewListProps) {
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const { t: tBible } = useTranslation("bible");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteQuestion = useDeleteQuestion();
  const duplicateQuestion = useDuplicateQuestion();

  const sorted = [...questions].sort((a, b) => a.position - b.position);
  const totalPoints = sorted.reduce((sum, q) => sum + q.points, 0);

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

  const moveButtons = (q: QuizQuestionResponse, index: number) => (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onMoveUp(q.id)}
        disabled={index === 0 || movePending}
        aria-label={t("admin.manage.moveUp")}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onMoveDown(q.id)}
        disabled={index === sorted.length - 1 || movePending}
        aria-label={t("admin.manage.moveDown")}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-arabic">
          5. {t("admin.question.options")}
        </CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="me-1 h-4 w-4" />
          {t("admin.builder.addQuestion")}
        </Button>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground font-arabic">
              {t("admin.manage.noQuestions")}
            </p>
            <Button size="sm" className="mt-3" onClick={onAdd}>
              <Plus className="me-1 h-4 w-4" />
              {t("admin.builder.addQuestion")}
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 font-arabic">الترتيب</TableHead>
                    <TableHead className="font-arabic">{t("admin.question.text")}</TableHead>
                    <TableHead className="font-arabic">{t("admin.question.options")}</TableHead>
                    <TableHead className="font-arabic">{t("admin.question.points")}</TableHead>
                    <TableHead className="text-start font-arabic">{t("admin.question.correctAnswer")}</TableHead>
                    <TableHead className="text-start font-arabic">{tBible("admin.table.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((q, index) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {moveButtons(q, index)}
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {index + 1}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate font-arabic">
                        {q.question}
                      </TableCell>
                      <TableCell className="font-arabic">
                        {q.options.length} خيارات
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-arabic">
                          {q.points} نقطة
                        </Badge>
                      </TableCell>
                      <TableCell className="text-start">
                        {q.options.filter((o) => o.is_correct).length > 0 ? (
                          <span className="text-green-600 text-sm">✓</span>
                        ) : (
                          <span className="text-destructive text-sm">✗</span>
                        )}
                      </TableCell>
                      <TableCell className="text-start">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteId(q.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                            className="h-7 w-7"
                            onClick={() => onEdit(q)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {sorted.map((q, index) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex flex-col items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onMoveUp(q.id)}
                      disabled={index === 0 || movePending}
                      aria-label={t("admin.manage.moveUp")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onMoveDown(q.id)}
                      disabled={index === sorted.length - 1 || movePending}
                      aria-label={t("admin.manage.moveDown")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium font-arabic">{q.question}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-arabic">{q.options.length} خيارات</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-xs font-arabic">
                        {q.points} نقطة
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(q)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
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
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
              <span className="font-arabic">
                عرض 1 إلى {sorted.length} من {sorted.length} أسئلة
              </span>
              <span className="font-arabic font-medium">
                إجمالي النقاط: {totalPoints} نقطة
              </span>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-arabic">
              {t("admin.builder.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-arabic">
              {t("admin.builder.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-arabic">{tCommon("back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-arabic"
              disabled={deleteQuestion.isPending}
            >
              {deleteQuestion.isPending ? "..." : t("admin.builder.deleteQuestion")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}