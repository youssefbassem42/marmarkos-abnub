import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GradedQuestion, AttemptStatus } from "../types";

interface QuestionReviewListProps {
  questions: GradedQuestion[];
  status: AttemptStatus;
}

export function QuestionReviewList({
  questions,
  status,
}: QuestionReviewListProps) {
  const { t } = useTranslation("quiz");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {questions.map((q, idx) => {
        const isOpen = openIds.has(q.id);
        const isTimedOut = status === "AUTO_FINISHED";
        return (
          <Collapsible key={q.id} open={isOpen} onOpenChange={() => toggle(q.id)}>
            <Card>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-4 text-start cursor-pointer"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    {q.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <CardTitle className="flex-1 text-sm font-medium">
                    {t("result.review.question", { number: idx + 1 })}
                  </CardTitle>
                  <Badge variant={q.is_correct ? "default" : "destructive"} className="shrink-0">
                    {q.points_awarded}/{q.points}
                  </Badge>
                  {isTimedOut && (
                    <Badge variant="secondary" className="shrink-0">
                      Timed Out
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">{q.question}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => {
                      const isUserSelected = opt.id === q.selected_option_id;
                      const isCorrectOption = opt.id === q.correct_option_id;
                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            "rounded-lg border p-2.5 text-sm",
                            isCorrectOption &&
                              "border-green-500 bg-green-50 dark:bg-green-950",
                            isUserSelected &&
                              !isCorrectOption &&
                              "border-red-500 bg-red-50 dark:bg-red-950",
                            !isCorrectOption &&
                              !isUserSelected &&
                              "border-transparent bg-muted/50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {opt.option_text}
                            </span>
                            {isUserSelected && (
                              <Badge variant="outline" className="text-[10px]">
                                {t("result.review.yourAnswer")}
                              </Badge>
                            )}
                            {isCorrectOption && (
                              <Badge variant="default" className="text-[10px]">
                                {t("result.review.correctAnswer")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
