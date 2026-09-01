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

interface QuizValidationPanelProps {
  quizId: string;
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
          {validation.ready ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          {validation.ready
            ? t("admin.validation.readyToPublish")
            : t("admin.validation.notReady")}
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
  );
}
