import { useTranslation } from "react-i18next";
import { LogIn, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoginForm } from "./LoginForm";

interface AuthCardProps {
  lang: "ar" | "en";
}

export function AuthCard({ lang }: AuthCardProps) {
  const { t } = useTranslation("login");
  const isArabic = lang === "ar";

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="flex w-full items-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-14"
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/15">
            <LogIn className="h-7 w-7 text-mint" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold text-ink">
            {t("card.heading")}
          </h2>
          <p
            className={cn(
              "mt-2 leading-relaxed text-muted-foreground",
              isArabic ? "font-arabic text-xl" : "text-base",
            )}
          >
            {t("card.subtitle")}
          </p>
        </div>

        <LoginForm lang={lang} />

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-mint"
            aria-hidden="true"
          />
          <span className={cn(isArabic && "font-arabic text-base")}>
            {t("security")}
          </span>
        </div>
      </div>
    </section>
  );
}
