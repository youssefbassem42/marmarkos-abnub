import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/layout/Navbar";
import { BrandFooterStrip } from "@/components/layout/BrandFooterStrip";
import { BrandPanel } from "@/pages/auth/components/BrandPanel";
import { cn } from "@/lib/utils";
import { AnonymousMessageForm } from "../components/AnonymousMessageForm";
import { BeforeYouSendCard } from "../components/BeforeYouSendCard";
import { ImportantInfoCard } from "../components/ImportantInfoCard";
import { MessageTopicsCard } from "../components/MessageTopicsCard";
import type { AnonymousMessageCreateResponse } from "../types";

/**
 * Public anonymous message page (US-019, DR-9): light brand panel on
 * the start side (hidden below md), the submission card on the other,
 * the two guidance cards beneath, closed by the navy footer strip.
 * Public by design (D-9) — the navbar shows the signed-in cluster or
 * the login CTA exactly as everywhere else; no fake avatar.
 */
export function AnonymousMessagePage() {
  const { t } = useTranslation("anonymousMessages");
  const [result, setResult] = useState<AnonymousMessageCreateResponse | null>(
    null,
  );

  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex min-h-screen flex-col bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex w-full flex-1 flex-col lg:flex-row">
        <BrandPanel
          lang="ar"
          variant="light"
          className="hidden w-full md:flex lg:w-[30%]"
        />

        <section className="w-full bg-soft lg:w-[70%]">
          <div className="mx-auto w-full max-w-3xl px-5 py-10 lg:px-8">
            <header className="text-center">
              <h1
                className="font-heading text-3xl font-extrabold tracking-tight text-ink font-arabic"
              >
                {t("title")}
              </h1>
              <p
                className="mt-2 text-sm text-muted-foreground font-arabic text-base"
              >
                {t("subtitle")}
              </p>
            </header>

            <div className="mt-8">
              <AnonymousMessageForm onSubmitted={setResult} />
            </div>

            <MessageTopicsCard className="mt-6" />

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <ImportantInfoCard />
              <BeforeYouSendCard />
            </div>
          </div>
        </section>
      </main>

      <BrandFooterStrip />
    </div>
  );
}
