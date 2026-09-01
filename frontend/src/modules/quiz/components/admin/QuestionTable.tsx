import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Copy,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteQuestion } from "../../hooks/useDeleteQuestion";
import { useDuplicateQuestion } from "../../hooks/useDuplicateQuestion";
import { useReorderQuestions } from "../../hooks/useReorderQuestions";
import type { QuizQuestionResponse } from "../../types";

interface QuestionTableProps {
  quizId: string;
  questions: QuizQuestionResponse[];
  isLoading?: boolean;
}

export function QuestionTable({
  quizId,
  questions,
  isLoading,
}: QuestionTableProps) {
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const deleteQuestion = useDeleteQuestion();
  const duplicateQuestion = useDuplicateQuestion();
  const reorderQuestions = useReorderQuestions();

  const sorted = [...questions].sort((a, b) => a.position - b.position);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteQuestion.mutate(
      { quizId, questionId: deleteId },
      {
        onSuccess: () => {
          toast.success(t("admin.manage.deleteSuccess"));
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
            toast.success(t("admin.manage.duplicateSuccess"));
          },
          onError: () => {
            toast.error(tCommon("errors.unknown"));
          },
        },
      );
    },
    [quizId, duplicateQuestion, t],
  );

  const persistReorder = useCallback(
    (ids: string[]) => {
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
    },
    [quizId, reorderQuestions, t],
  );

  const handleDragStart = useCallback(
    (index: number) => {
      dragItem.current = index;
    },
    [],
  );

  const handleDragEnter = useCallback(
    (index: number) => {
      dragOverItem.current = index;
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const reordered = [...sorted];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, moved);

    const ids = reordered.map((q) => q.id);
    persistReorder(ids);
    setAnnouncement(
      t("admin.manage.reorderSuccess"),
    );

    dragItem.current = null;
    dragOverItem.current = null;
  }, [sorted, persistReorder, t]);

  const moveQuestion = useCallback(
    (index: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;

      const reordered = [...sorted];
      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ];

      const ids = reordered.map((q) => q.id);
      persistReorder(ids);
      setAnnouncement(
        t("admin.manage.reorderSuccess"),
      );
    },
    [sorted, persistReorder, t],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t("admin.manage.noQuestions")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("admin.manage.addFirstQuestion")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="w-12">
              {t("admin.builder.position")}
            </TableHead>
            <TableHead>{t("admin.question.text")}</TableHead>
            <TableHead className="w-20">
              {t("admin.question.options")}
            </TableHead>
            <TableHead className="w-20">
              {t("admin.question.points")}
            </TableHead>
            <TableHead className="w-28 text-end">
              {t("admin.builder.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((q, index) => (
            <TableRow
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="cursor-grab"
            >
              <TableCell>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </TableCell>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell>
                <span className="line-clamp-1">{q.question}</span>
              </TableCell>
              <TableCell>{q.options.length}</TableCell>
              <TableCell>{q.points}</TableCell>
              <TableCell className="text-end">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, "up")}
                    aria-label={t("admin.manage.moveUp")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === sorted.length - 1}
                    onClick={() => moveQuestion(index, "down")}
                    aria-label={t("admin.manage.moveDown")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                  >
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.manage.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.manage.deleteConfirmDescription")}
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
    </>
  );
}
