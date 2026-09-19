import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuizValidation } from "../../hooks/useQuizValidation";
import type { QuizValidationRule } from "../../types";

interface QuizValidationPanelProps {
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

export function QuizValidationPanel({ quizId }: QuizValidationPanelProps) {
  const { t } = useTranslation("quiz");
  const { data: validation, isLoading } = useQuizValidation(quizId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!validation) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {validation.is_publishable ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          {validation.is_publishable
            ? t("admin.validation.readyToPublish")
            : t("admin.validation.notReady")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {validation.is_publishable ? (
          <p className="text-sm text-green-600 font-arabic">
            {t("admin.validation.allPassed")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {validation.rules.map((rule: QuizValidationRule) => (
              <li
                key={rule.code}
                className="flex items-start gap-2 text-sm"
              >
                {rule.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <span className="font-arabic">
                  <RuleText code={rule.code} detail={rule.detail} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}