import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
  lang: "ar" | "en";
}

export function PasswordRequirements({
  password,
  lang,
}: PasswordRequirementsProps) {
  const { t } = useTranslation("resetPassword");
  const isArabic = lang === "ar";
  const requirements = t("form.requirements", {
    returnObjects: true,
  }) as readonly string[];

  const rules = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const touched = password.length > 0;

  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {requirements.map((label, index) => {
        const met = rules[index];
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 transition-colors",
              met
                ? "text-mint"
                : touched
                  ? "text-brand-red"
                  : "text-muted-foreground",
            )}
          >
            {met ? (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-mint"
                aria-hidden="true"
              />
            ) : touched ? (
              <CircleX
                className="h-4 w-4 shrink-0 text-brand-red/80"
                aria-hidden="true"
              />
            ) : (
              <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(
                "text-sm leading-snug",
                isArabic && "font-arabic text-base",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
