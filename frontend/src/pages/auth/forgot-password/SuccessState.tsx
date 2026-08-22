import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuccessStateProps {
  lang: "ar" | "en";
}

export function SuccessState({ lang }: SuccessStateProps) {
  const { t } = useTranslation("forgotPassword");
  const isArabic = lang === "ar";

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
        <CheckCircle2 className="h-9 w-9 text-mint" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-heading text-3xl font-bold text-ink">
        {t("validation.successTitle")}
      </h2>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground",
          isArabic ? "font-arabic text-xl" : "text-base",
        )}
      >
        {t("validation.successMessage")}
      </p>
      <Button
        asChild
        className="mt-6 h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
      >
        <Link to="/login">{t("validation.successLogin")}</Link>
      </Button>
      <Link
        to="/"
        className={cn(
          "mt-4 font-semibold text-brand-blue underline-offset-4 hover:underline",
          isArabic && "font-arabic text-lg",
        )}
      >
        {t("validation.successHome")}
      </Link>
    </div>
  );
}
