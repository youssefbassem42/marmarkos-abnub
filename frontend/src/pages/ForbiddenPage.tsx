import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Brand-consistent 403 page: visible, never a silent bounce. */
export function ForbiddenPage() {
  const { t } = useTranslation("common");

  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex min-h-screen flex-col items-center justify-center bg-soft px-5 text-center"
    >
      <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-red/10">
        <ShieldAlert className="h-10 w-10 text-brand-red" aria-hidden="true" />
      </span>
      <h1
        className="mt-6 text-3xl font-bold text-ink font-arabic text-4xl"
      >
        {t("forbidden.title")}
      </h1>
      <p
        className="mt-3 max-w-md leading-relaxed text-muted-foreground font-arabic text-lg"
      >
        {t("forbidden.body")}
      </p>
      <Link to="/" className="btn-outline mt-8 px-6 py-3">
        <span className="font-arabic">
          {t("forbidden.cta")}
        </span>
      </Link>
    </div>
  );
}
