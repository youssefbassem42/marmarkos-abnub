import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Lightbulb, Check, AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizValidation } from "../../hooks/useQuizValidation";
import type { QuizValidationRule } from "../../types";

interface QuizReadinessPanelProps {
  quizId: string;
}

function RuleText({ code, detail }: { code: string; detail: string }) {
  const { t } = useTranslation("quiz");

  switch (code) {
    case "has_questions":
      return t("admin.validation.ruleHasQuestions");
    case "has_options":
      return t("admin.validation.ruleHasOptions");
    case "single_correct":
      return t("admin.validation.ruleSingleCorrect");
    case "verse_published":
      return t("admin.validation.ruleVersePublished");
    default:
      return detail;
  }
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

  const rules: QuizValidationRule[] = validation.rules;

  return (
    <div className="space-y-4">
      {/* جاهزية الاختبار */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium font-arabic">
            {validation.is_publishable ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            {t("admin.validation.readyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.code} className="flex items-center gap-3 text-sm">
              {rule.passed ? (
                <Check className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              <span className="font-arabic">
                <RuleText code={rule.code} detail={rule.detail} />
              </span>
              {!rule.passed && (
                <span className="text-xs text-muted-foreground font-arabic">
                  (غير مكتمل)
                </span>
              )}
            </div>
          ))}

          {validation.is_publishable ? (
            <div className="mt-2 rounded-lg bg-green-50 p-3 text-center dark:bg-green-950">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-700 dark:text-green-300 font-arabic">
                <CheckCircle2 className="h-4 w-4" />
                {t("admin.validation.readyToPublish")}
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-arabic">
                {t("admin.validation.readyHint")}
              </p>
            </div>
          ) : (
            <div className="mt-2 rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-950">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 font-arabic">
                <AlertTriangle className="h-4 w-4" />
                {t("admin.validation.notReady")}
              </div>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-arabic">
                {t("admin.validation.fixIssuesHint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نصائح */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium font-arabic">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            {t("admin.builder.tips")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground font-arabic">
            {t("admin.builder.tipCorrectAnswer")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}