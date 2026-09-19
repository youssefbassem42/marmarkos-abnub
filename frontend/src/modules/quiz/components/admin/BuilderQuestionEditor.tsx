import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useSaveQuestion } from "../../hooks/useSaveQuestion";
import { useUpdateQuestion } from "../../hooks/useUpdateQuestion";
import type { QuizQuestionResponse } from "../../types";
import { questionSchema, type QuestionFormValues } from "./questionSchema";
import { QuestionForm } from "./QuestionForm";
import { QuestionPreview } from "./QuestionPreview";
import { QuestionValidationPanel } from "./QuestionValidationPanel";

interface BuilderQuestionEditorProps {
  quizId: string;
  editing: QuizQuestionResponse | null;
  onClose: () => void;
  onSaved: () => void;
}

const blankOptions = (): { optionText: string; isCorrect: boolean }[] => [
  { optionText: "", isCorrect: true },
  { optionText: "", isCorrect: false },
];

export function BuilderQuestionEditor({
  quizId,
  editing,
  onClose,
  onSaved,
}: BuilderQuestionEditorProps) {
  const { t } = useTranslation("quiz");

  const saveQuestion = useSaveQuestion();
  const updateQuestion = useUpdateQuestion();
  const isPending = saveQuestion.isPending || updateQuestion.isPending;

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
      options: blankOptions(),
    },
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        question: editing.question,
        points: editing.points,
        options: editing.options.map((o) => ({
          optionText: o.option_text,
          isCorrect: o.is_correct,
          id: o.id,
        })),
      });
    } else {
      form.reset({
        question: "",
        points: 1,
        options: blankOptions(),
      });
    }
  }, [editing, form]);

  const watchedQuestion = form.watch("question") ?? "";
  const watchedOptions = form.watch("options");

  const handleSave = form.handleSubmit((values) => {
    const options = values.options.map((o, index) => ({
      option_text: o.optionText,
      is_correct: o.isCorrect,
      ...(editing ? { id: o.id, position: index + 1 } : {}),
    }));

    const onDone = () => {
      toast.success(t("admin.question.savedToast"));
      onSaved();
    };
    const onError = () => {
      toast.error(t("admin.question.saveError"));
    };

    if (editing) {
      updateQuestion.mutate(
        {
          quizId,
          questionId: editing.id,
          data: {
            question: values.question,
            points: values.points,
            options,
          },
        },
        { onSuccess: onDone, onError },
      );
      return;
    }

    saveQuestion.mutate(
      {
        quizId,
        data: { question: values.question, points: values.points, options },
      },
      { onSuccess: onDone, onError },
    );
  });

  return (
    <Card className="scroll-mt-4 border-brand-blue/40 ring-1 ring-brand-blue/20">
      <CardHeader>
        <CardTitle className="font-arabic">
          {editing
            ? t("admin.question.editTitle")
            : t("admin.question.newTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Form {...form}>
              <QuestionForm form={form} />
            </Form>
          </div>
          <div className="space-y-6">
            <QuestionPreview question={watchedQuestion} options={watchedOptions} />
            <QuestionValidationPanel
              question={watchedQuestion}
              options={watchedOptions}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          <X className="me-1 h-4 w-4" />
          {t("admin.builder.cancelEditing")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Save className="me-1 h-4 w-4" />
          {isPending
            ? t("admin.question.savingButton")
            : t("admin.question.saveButton")}
        </Button>
      </CardFooter>
    </Card>
  );
}