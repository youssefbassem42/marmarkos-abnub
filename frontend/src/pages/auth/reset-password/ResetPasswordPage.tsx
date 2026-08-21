import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/context";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { language } = useLanguage();
  const [stage, setStage] = useState<"form" | "success">("form");
  const isArabic = language === "ar";

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row" dir="ltr">
        <BrandPanel lang={language} />
        <AuthCard
          lang={language}
          token={token}
          stage={stage}
          onSuccess={() => setStage("success")}
        />
      </main>

      <AuthFooter lang={language} />
    </div>
  );
}
