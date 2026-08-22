import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthProgressProps {
  lang: "ar" | "en";
}

export function AuthProgress({ lang }: AuthProgressProps) {
  const { t } = useTranslation("resetPassword");
  const isArabic = lang === "ar";
  const steps = t("progress.steps", {
    returnObjects: true,
  }) as readonly string[];
  const activeIndex = steps.length - 1;

  return (
    <ol
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="flex w-full items-start gap-1 sm:gap-2"
      aria-label={t("progress.ariaLabel")}
    >
      {steps.map((label, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <Fragment key={label}>
            <li className="flex flex-1 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors",
                  isActive && "bg-mint text-white ring-4 ring-mint/25",
                  isCompleted && "bg-mint text-white",
                  !isActive &&
                    !isCompleted &&
                    "bg-gray-200 text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "leading-tight transition-colors",
                  isArabic
                    ? "font-arabic text-sm sm:text-base"
                    : "text-xs font-medium sm:text-sm",
                  isActive && "font-bold text-ink",
                  isCompleted && "font-semibold text-mint",
                  !isActive && !isCompleted && "text-gray-400",
                )}
              >
                {label}
              </span>
            </li>
            {index < activeIndex ? (
              <span
                aria-hidden="true"
                className="mt-4 min-w-3 flex-1 border-t-2 border-dotted border-mint"
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
