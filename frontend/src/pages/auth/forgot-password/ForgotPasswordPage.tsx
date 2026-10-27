import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { AuthCard } from "./AuthCard";

export function ForgotPasswordPage() {
  const [stage, setStage] = useState<"form" | "success">("form");
  const [sentEmail, setSentEmail] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel />
        <AuthCard
          stage={stage}
          sentEmail={sentEmail}
          onSuccess={(email) => {
            setSentEmail(email);
            setStage("success");
          }}
        />
      </main>

      <AuthFooter />
    </div>
  );
}
