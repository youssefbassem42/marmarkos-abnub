import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { cn } from "@/lib/utils";

type Status = "verifying" | "success" | "error";

/**
 * Landing page of the emailed verification link
 * (`/verify-email/confirm?token=…`). Consumes the token exactly once
 * and shows the outcome; StrictMode double-mounts are guarded by a ref.
 */
export function VerifyEmailResultPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { t } = useTranslation("verification");
  const [status, setStatus] = useState<Status>("verifying");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await verifyEmail({ token });
        if (!cancelled) setStatus("success");
      } catch {
        // The endpoint answers neutrally on unknown/expired links.
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    document.title = t("confirm.title");
  }, [t]);

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        <BrandPanel lang="ar" />
        <section
          dir="rtl"
          lang="ar"
          className="flex w-full items-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-14"
        >
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 card-elevated sm:p-10">
            {status === "verifying" ? (
              <Verifying />
            ) : status === "success" ? (
              <Success />
            ) : (
              <Error />
            )}
          </div>
        </section>
      </main>

      <AuthFooter lang="ar" />
    </div>
  );
}

function Verifying() {
  const { t } = useTranslation("verification");
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
        <Loader2
          className="h-8 w-8 animate-spin text-mint"
          aria-hidden="true"
        />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-bold text-ink">
        {t("confirm.verifyingTitle")}
      </h1>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground font-arabic text-xl",
        )}
      >
        {t("confirm.verifyingMessage")}
      </p>
    </div>
  );
}

function Success() {
  const { t } = useTranslation("verification");
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
        <CheckCircle2 className="h-9 w-9 text-mint" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-bold text-ink">
        {t("confirm.successTitle")}
      </h1>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground font-arabic text-xl",
        )}
      >
        {t("confirm.successMessage")}
      </p>
      <Button
        asChild
        className="mt-6 h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
      >
        <Link to="/login">
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
          {t("confirm.successCta")}
        </Link>
      </Button>
    </div>
  );
}

function Error() {
  const { t } = useTranslation("verification");
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-red/10">
        <AlertTriangle className="h-9 w-9 text-brand-red" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-bold text-ink">
        {t("confirm.errorTitle")}
      </h1>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground font-arabic text-xl",
        )}
      >
        {t("confirm.errorMessage")}
      </p>
      <Button
        asChild
        className="mt-6 h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
      >
        <Link to="/verify-email">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
          {t("confirm.resendCta")}
        </Link>
      </Button>
      <Link
        to="/login"
        className={cn(
          "mt-4 font-semibold text-brand-blue underline-offset-4 hover:underline font-arabic text-lg",
        )}
      >
        {t("confirm.loginLink")}
      </Link>
    </div>
  );
}
