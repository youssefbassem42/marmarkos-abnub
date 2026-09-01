import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [stage, setStage] = useState<"form" | "success">("form");

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel lang="ar" />
        <AuthCard
          lang="ar"
          token={token}
          stage={stage}
          onSuccess={() => setStage("success")}
        />
      </main>

      <AuthFooter lang="ar" />
    </div>
  );
}
