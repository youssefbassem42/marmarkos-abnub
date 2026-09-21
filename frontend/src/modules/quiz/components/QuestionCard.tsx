import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuizTakeQuestion } from "../types";

interface QuestionCardProps {
  question: QuizTakeQuestion;
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  questionNumber: number;
  totalQuestions: number;
  /** Answers are locked once the active-time budget hits zero (V2). */
  disabled?: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  selectedOptionId,
  onSelect,
  questionNumber,
  totalQuestions,
  disabled = false,
}: QuestionCardProps) {
  const { t } = useTranslation("quiz");

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-relaxed">
            {question.question}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {question.points} {question.points === 1 ? "pt" : "pts"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("take.question")} {questionNumber}{" "}
          {t("take.of", { total: totalQuestions })}
        </p>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedOptionId}
          onValueChange={onSelect}
          disabled={disabled}
          className="gap-3"
        >
          {question.options.map((option, idx) => (
            <label
              key={option.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                !disabled && "cursor-pointer hover:bg-accent/50",
                disabled && "cursor-not-allowed opacity-70",
                selectedOptionId === option.id && "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem value={option.id} id={option.id} />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {OPTION_LABELS[idx] ?? idx + 1}
              </span>
              <span className="text-sm leading-snug">{option.option_text}</span>
            </label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
