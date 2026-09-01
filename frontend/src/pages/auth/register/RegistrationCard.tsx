import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegistrationForm } from "./RegistrationForm";

interface RegistrationCardProps {
  lang: "ar" | "en";
}

export function RegistrationCard({ lang }: RegistrationCardProps) {
  const { t } = useTranslation("register");
  const navigate = useNavigate();

  // The account exists but stays inactive until the emailed link is
  // confirmed, so the flow continues on the "check your mail" step.
  const handleRegistered = (email: string) => {
    navigate({
      pathname: "/verify-email",
      search: `?email=${encodeURIComponent(email)}`,
    });
  };

  return (
    <section
      dir="rtl"
      lang="ar"
      className="flex w-full items-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-14"
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 card-elevated sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-mint/15">
            <UserRound className="h-7 w-7 text-mint" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold text-ink">
            {t("card.heading")}
          </h2>
          <p
            className={cn(
              "mt-2 text-muted-foreground font-arabic text-xl",
            )}
          >
            {t("card.subtitle")}
          </p>
        </div>
        <RegistrationForm onSuccess={handleRegistered} lang={lang} />
      </div>
    </section>
  );
}
