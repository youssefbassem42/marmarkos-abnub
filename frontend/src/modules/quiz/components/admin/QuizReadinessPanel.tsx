import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Lightbulb, AlertTriangle, Check } from "lucide-react";

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
      {/* جاهزية الاختبار */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium font-arabic">
            {validation.ready ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            جاهزية الاختبار
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-arabic">تودأ أسئلة</span>
            <span className="text-xs text-muted-foreground font-arabic">
              ({validation.issues.length === 0 ? "تمت إضافة 5 أسئلة" : `${validation.issues.length} مشكلة`})
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-arabic">الإجابات الصحيحة محددة</span>
            <span className="text-xs text-muted-foreground font-arabic">
              (كل سؤال له إجابة صحيحة واحدة)
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-arabic">الموقع مضبوط</span>
            <span className="text-xs text-muted-foreground font-arabic">(2 دقائق)</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-arabic">النقاط مضبوطة</span>
            <span className="text-xs text-muted-foreground font-arabic">(إجمالي النقاط: 10 نقاط)</span>
          </div>

          {validation.ready ? (
            <div className="mt-2 rounded-lg bg-green-50 p-3 text-center dark:bg-green-950">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-700 dark:text-green-300 font-arabic">
                <CheckCircle2 className="h-4 w-4" />
                الاختبار جاهز للنشر!
              </div>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-arabic">
                يمكنك نشر هذا الاختبار.
              </p>
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {validation.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="font-arabic">{issue}</span>
                </li>
              ))}
            </ul>
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
            تأكد من أن كل سؤال لديك إجابة صحيحة وأن النقاط مناسبة لمستوى الأسئلة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
