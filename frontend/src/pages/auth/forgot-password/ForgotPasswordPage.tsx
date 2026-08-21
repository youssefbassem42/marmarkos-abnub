import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function ForgotPasswordPage() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation("common");
  const [stage, setStage] = useState<"form" | "success">("form");
  const isArabic = language === "ar";

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="min-h-screen bg-background"
    >
      <button
        type="button"
        onClick={() => setLanguage(isArabic ? "en" : "ar")}
        aria-label={t("langToggle.ariaLabel")}
        className="fixed top-4 right-4 z-20 rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-soft focus-ring"
      >
        {t("langToggle.label")}
      </button>

      <main className="flex min-h-screen flex-col lg:flex-row" dir="ltr">
        <BrandPanel lang={language} />
        <AuthCard
          lang={language}
          stage={stage}
          onSuccess={() => setStage("success")}
        />
      </main>

      <AuthFooter lang={language} />
    </div>
  );
}
