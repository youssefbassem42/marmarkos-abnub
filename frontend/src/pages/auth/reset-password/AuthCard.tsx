import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthProgress } from "./AuthProgress";
import { ErrorState } from "./ErrorState";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { SuccessState } from "./SuccessState";

interface AuthCardProps {
  lang: "ar" | "en";
  token: string;
  stage: "form" | "success";
  onSuccess: () => void;
}

export function AuthCard({ lang, token, stage, onSuccess }: AuthCardProps) {
  const { t } = useTranslation("resetPassword");
  const isArabic = lang === "ar";

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="flex w-full items-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-14"
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:p-10">
        {token ? (
          stage === "success" ? (
            <SuccessState lang={lang} />
          ) : (
            <>
              <div className="mb-8 flex flex-col items-center text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/15">
                  <Lock className="h-7 w-7 text-mint" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-heading text-3xl font-bold text-navy">
                  {t("card.heading")}
                </h2>
                <p
                  className={cn(
                    "mt-2 leading-relaxed text-muted-foreground",
                    isArabic ? "font-arabic text-xl" : "text-base",
                  )}
                >
                  {t("card.subtitlePrefix")}{" "}
                  <span className="font-semibold text-mint">
                    {t("card.subtitleAccent")}
                  </span>
                </p>
              </div>

              <AuthProgress lang={lang} />

              <div className="mt-8">
                <ResetPasswordForm
                  lang={lang}
                  token={token}
                  onSuccess={onSuccess}
                />
              </div>
            </>
          )
        ) : (
          <ErrorState lang={lang} />
        )}
      </div>
    </section>
  );
}
