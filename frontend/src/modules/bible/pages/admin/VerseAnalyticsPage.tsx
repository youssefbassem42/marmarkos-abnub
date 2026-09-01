import { useTranslation } from "react-i18next";

export default function VerseAnalyticsPage() {
  const { t } = useTranslation("common");
  return (
    <div className="p-8">
      <h1>{t("comingSoon")}</h1>
    </div>
  );
}
