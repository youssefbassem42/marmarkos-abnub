import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OptionField } from "./questionSchema";

interface QuestionValidationPanelProps {
  question: string;
  options: OptionField[];
}

interface ValidationRule {
  label: string;
  passed: boolean;
}

export function QuestionValidationPanel({
  question,
  options,
}: QuestionValidationPanelProps) {
  const { t } = useTranslation("quiz");

  const rules: ValidationRule[] = [
    {
      label: t("admin.question.questionRequired"),
      passed: question.trim().length > 0,
    },
    {
      label: t("admin.question.optionsRequired"),
      passed: options.length >= 2 && options.length <= 6,
    },
    {
      label: t("admin.question.correctRequired"),
      passed: options.some((o) => o.isCorrect),
    },
  ];

  const allPassed = rules.every((r) => r.passed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {allPassed ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-yellow-600" />
          )}
          {allPassed
            ? t("admin.validation.readyToPublish")
            : t("admin.validation.notReady")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {rule.passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
