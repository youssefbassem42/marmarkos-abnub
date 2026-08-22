import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RegistrationForm } from "./RegistrationForm";

interface RegistrationCardProps {
  lang: "ar" | "en";
}

export function RegistrationCard({ lang }: RegistrationCardProps) {
  const { t } = useTranslation("register");
  const isArabic = lang === "ar";
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="flex w-full items-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-14"
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:p-10">
        {registeredEmail ? (
          <div className="flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
              <CheckCircle2 className="h-9 w-9 text-mint" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-heading text-3xl font-bold text-ink">
              {t("card.successTitle")}
            </h2>
            <p
              className={cn(
                "mt-3 max-w-sm leading-relaxed text-muted-foreground",
                isArabic ? "font-arabic text-xl" : "text-base",
              )}
            >
              {t("card.successMessage")}
            </p>
            <Button
              asChild
              className="mt-6 h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
            >
              <Link to="/login">{t("card.successLogin")}</Link>
            </Button>
            <Link
              to="/"
              className={cn(
                "mt-4 font-semibold text-brand-blue underline-offset-4 hover:underline",
                isArabic && "font-arabic text-lg",
              )}
            >
              {t("card.successHome")}
            </Link>
            <p className="mt-6 text-sm text-muted-foreground" dir="ltr">
              {registeredEmail}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/15">
                <UserRound className="h-7 w-7 text-mint" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold text-ink">
                {t("card.heading")}
              </h2>
              <p
                className={cn(
                  "mt-2 text-muted-foreground",
                  isArabic ? "font-arabic text-xl" : "text-base",
                )}
              >
                {t("card.subtitle")}
              </p>
            </div>
            <RegistrationForm onSuccess={setRegisteredEmail} lang={lang} />
          </>
        )}
      </div>
    </section>
  );
}
