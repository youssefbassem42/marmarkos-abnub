import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";

export function ResultHeader() {
  const { t } = useTranslation("quiz");

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950">
        <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{t("result.completed")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("result.subtitle")}
        </p>
      </div>
    </div>
  );
}
