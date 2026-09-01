import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Lightbulb, AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizValidation } from "../../hooks/useQuizValidation";

interface QuizReadinessPanelProps {
  quizId: string;
}

export function QuizReadinessPanel({ quizId }: QuizReadinessPanelProps) {
  const { t } = useTranslation("quiz");
  const { data: validation, isLoading } = useQuizValidation(quizId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validation) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            {validation.ready ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            {validation.ready
              ? t("admin.builder.readyToPublish")
              : t("admin.builder.notReady")}
            {!validation.ready && (
              <span className="text-xs text-muted-foreground">
                ·{" "}
                {t("admin.builder.issuesFound", {
                  count: validation.issues.length,
                })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validation.ready ? (
            <p className="text-sm text-green-600">
              {t("admin.validation.allPassed")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {validation.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            {t("admin.builder.tips")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {t("admin.builder.tipMinQuestions")}
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {t("admin.builder.tipCorrectAnswer")}
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {t("admin.builder.tipDuration")}
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {t("admin.builder.tipTitle")}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
