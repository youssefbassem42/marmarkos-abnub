import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Star } from "lucide-react";

interface ScoreSummaryProps {
  score: number;
  totalPoints: number;
  correctCount: number;
  incorrectCount: number;
}

export function ScoreSummary({
  score,
  totalPoints,
  correctCount,
  incorrectCount,
}: ScoreSummaryProps) {
  const { t } = useTranslation("quiz");
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-4xl font-bold">
          {score}
          <span className="text-lg font-normal text-muted-foreground">
            {" "}
            / {totalPoints}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{percentage}%</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-lg font-semibold leading-tight">{correctCount}</p>
              <p className="text-xs text-muted-foreground">{t("result.correct")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-lg font-semibold leading-tight">{incorrectCount}</p>
              <p className="text-xs text-muted-foreground">{t("result.incorrect")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-3">
            <Star className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-lg font-semibold leading-tight">{score}</p>
              <p className="text-xs text-muted-foreground">
                {t("result.pointsEarned", { score, total: totalPoints })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
