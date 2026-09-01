import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimesUpPanelProps {
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function TimesUpPanel({ onSubmit, isSubmitting }: TimesUpPanelProps) {
  const { t } = useTranslation("quiz");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="mx-4 max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <Clock className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">{t("take.timesUp")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("take.expired")}
          </p>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting
              ? t("take.submitting")
              : t("result.viewPoints")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
