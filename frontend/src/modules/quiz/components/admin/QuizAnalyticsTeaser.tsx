import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart3, ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface QuizAnalyticsTeaserProps {
  quizId: string;
}

export function QuizAnalyticsTeaser({ quizId }: QuizAnalyticsTeaserProps) {
  const { t } = useTranslation("quiz");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          {t("admin.manage.analyticsTeaser")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link
          to={`/admin/analytics/quizzes?quizId=${quizId}`}
          className="flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("admin.manage.viewAnalytics")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
