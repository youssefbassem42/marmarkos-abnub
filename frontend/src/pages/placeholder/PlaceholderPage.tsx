import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  /** i18n key under landing.nav, e.g. "blog" */
  titleKey: "anonymous" | "blog" | "gallery" | "aboutUs" | "notifications";
}

/** Temporary stand-in page for sections under construction. */
export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const title = t(`nav.${titleKey}`);

  return (
    <div dir={isArabic ? "rtl" : "ltr"} lang={language} className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 pb-24 pt-40 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-mint/15">
          <Construction className="h-10 w-10 text-mint" aria-hidden="true" />
        </span>
        <h1 className={cn("text-3xl font-extrabold tracking-tight text-navy", isArabic && "font-arabic")}>
          {title}
        </h1>
        <p className={cn("max-w-md leading-relaxed text-muted-foreground", isArabic && "font-arabic text-lg")}>
          {isArabic ? "هذه الصفحة قيد الإنشاء — عرفنا قريبًا!" : "This page is under construction — check back soon!"}
        </p>
        <Link
          to="/"
          className={cn(
            "btn-primary mt-2 px-6 py-3 text-sm",
            isArabic ? "font-arabic" : "",
          )}
        >
          {t("nav.home")}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
