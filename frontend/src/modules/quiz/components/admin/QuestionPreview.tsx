import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OptionField } from "./questionSchema";

interface QuestionPreviewProps {
  question: string;
  options: OptionField[];
}

export function QuestionPreview({ question, options }: QuestionPreviewProps) {
  const { t } = useTranslation("quiz");
  const letters = t("admin.question.optionLetters", {
    returnObjects: true,
  }) as unknown as string[];

  const correctIndex = options.findIndex((o) => o.isCorrect);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4" />
          {t("admin.question.preview")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("admin.question.previewHint")}
        </p>

        {question && (
          <p className="font-medium">{question}</p>
        )}

        <div className="space-y-2">
          {options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border p-2 text-sm"
            >
              <Badge
                variant={opt.isCorrect ? "default" : "outline"}
                className="h-6 w-6 shrink-0 items-center justify-center text-xs"
              >
                {letters[i] ?? String.fromCharCode(65 + i)}
              </Badge>
              <span className="flex-1">{opt.optionText || "—"}</span>
              {opt.isCorrect && (
                <Badge variant="secondary" className="text-xs">
                  ✓
                </Badge>
              )}
            </div>
          ))}
        </div>

        {correctIndex >= 0 && (
          <p className="text-xs text-green-600">
            {t("admin.question.correctAnswerLabel", {
              letter: letters[correctIndex] ?? String.fromCharCode(65 + correctIndex),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
