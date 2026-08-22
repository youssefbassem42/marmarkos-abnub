import { useLanguage } from "@/i18n/context";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function LoginPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel lang={language} />
        <AuthCard lang={language} />
      </main>

      <AuthFooter lang={language} />
    </div>
  );
}
