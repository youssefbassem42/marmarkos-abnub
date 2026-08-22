import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  className?: string;
  /** "light" for light backgrounds, "dark" for navy/dark sections */
  tone?: "light" | "dark";
}

/** AR/EN pill button; shows the language you can switch TO. */
export function LanguageToggle({
  className,
  tone = "light",
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation("common");
  const isArabic = language === "ar";

  return (
    <button
      type="button"
      onClick={() => setLanguage(isArabic ? "en" : "ar")}
      aria-label={t("langToggle.ariaLabel")}
      title={t("langToggle.ariaLabel")}
      className={cn(
        "focus-ring inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold shadow-sm transition-colors",
        tone === "light"
          ? "border-border bg-card text-ink hover:bg-secondary"
          : "border-white/30 bg-white/10 text-white hover:bg-white/20",
        isArabic ? "font-arabic" : "",
        className,
      )}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {t("langToggle.label")}
    </button>
  );
}
