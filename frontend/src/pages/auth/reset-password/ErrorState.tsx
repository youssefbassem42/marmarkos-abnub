import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  lang: "ar" | "en";
}

export function ErrorState({ lang }: ErrorStateProps) {
  const { t } = useTranslation("resetPassword");
  const isArabic = lang === "ar";

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-red/10">
        <ShieldAlert className="h-9 w-9 text-brand-red" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-heading text-3xl font-bold text-navy">
        {t("errorState.title")}
      </h2>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground",
          isArabic ? "font-arabic text-xl" : "text-base",
        )}
      >
        {t("errorState.message")}
      </p>
      <Button
        asChild
        className="mt-6 h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
      >
        <Link to="/forgot-password">{t("errorState.requestNewLink")}</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        className={cn(
          "mt-3 h-12 w-full max-w-xs rounded-xl border-navy text-navy focus-ring",
          isArabic ? "font-arabic text-lg" : "text-base font-semibold",
        )}
      >
        <Link to="/login">{t("form.backToLogin")}</Link>
      </Button>
    </div>
  );
}
