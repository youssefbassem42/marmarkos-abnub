import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  /** i18n key under landing.nav, e.g. "blog" */
  titleKey: "blog" | "gallery" | "aboutUs";
}

/** Temporary stand-in page for sections under construction. */
export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  const title = t(`nav.${titleKey}`);

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 pb-24 pt-40 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-mint/15">
          <Construction className="h-10 w-10 text-mint" aria-hidden="true" />
        </span>
        <h1
          className="text-3xl font-extrabold tracking-tight text-ink font-arabic"
        >
          {title}
        </h1>
        <p
          className="max-w-md leading-relaxed text-muted-foreground font-arabic text-lg"
        >
          {tCommon("placeholder.body")}
        </p>
        <Link
          to="/"
          className="btn-primary mt-2 px-6 py-3 text-sm font-arabic"
        >
          {t("nav.home")}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
