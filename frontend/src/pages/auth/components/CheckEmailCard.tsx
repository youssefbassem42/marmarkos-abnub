import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_COOLDOWN_SECONDS = 60;

interface CheckEmailCardProps {
  lang: "ar" | "en";
  /** Address the mail was sent to; rendered in bold when provided. */
  email?: string;
  title: string;
  description: string;
  /** Extra hint under the description (spam folder note...). */
  note?: string;
  resendLabel: string;
  resentLabel?: string;
  resendFailedLabel?: string;
  backToLoginLabel: string;
  onResend: () => Promise<void>;
  /** Hides the resend action entirely (e.g. address unknown). */
  resendHidden?: boolean;
}

/**
 * Standard "mail sent" layout shared by every email-driven flow
 * (account verification, password reset). Owns the resend button with
 * its cooldown so callers only provide copy + an async send callback.
 */
export function CheckEmailCard({
  lang,
  email,
  title,
  description,
  note,
  resendLabel,
  resentLabel,
  resendFailedLabel,
  backToLoginLabel,
  onResend,
  resendHidden = false,
}: CheckEmailCardProps) {
  const { t } = useTranslation("verification");
  const isArabic = lang === "ar";
  const [cooldown, setCooldown] = useState(DEFAULT_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
  }, []);

  // Arm the cooldown immediately so the page cannot spam the endpoint;
  // stop it when the card unmounts.
  useEffect(() => {
    startCooldown(DEFAULT_COOLDOWN_SECONDS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [startCooldown]);

  const handleResend = async () => {
    setSending(true);
    setResent(false);
    setFailed(false);
    try {
      await onResend();
      setResent(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
      startCooldown(DEFAULT_COOLDOWN_SECONDS);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
        <MailCheck className="h-9 w-9 text-mint" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-heading text-3xl font-bold text-ink">{title}</h2>
      <p
        className={cn(
          "mt-3 max-w-sm leading-relaxed text-muted-foreground",
          isArabic ? "font-arabic text-xl" : "text-base",
        )}
      >
        {description}
      </p>
      {email ? (
        <p
          className="mt-2 text-sm font-semibold text-navy"
          dir="ltr"
          aria-label={t("sentTo")}
        >
          {email}
        </p>
      ) : null}

      {note ? (
        <p
          className={cn(
            "mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground/80",
            isArabic ? "font-arabic text-lg" : "",
          )}
        >
          {note}
        </p>
      ) : null}

      {resent && !resendHidden ? (
        <p
          role="status"
          className={cn(
            "mt-4 rounded-xl border border-mint/40 bg-mint/10 px-4 py-2.5 font-semibold text-navy",
            isArabic ? "font-arabic text-lg" : "text-sm",
          )}
        >
          {resentLabel ?? t("resent")}
        </p>
      ) : null}
      {failed && !resendHidden ? (
        <p
          role="alert"
          className={cn(
            "mt-4 rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-2.5 text-brand-red",
            isArabic ? "font-arabic text-lg" : "text-sm font-medium",
          )}
        >
          {resendFailedLabel ?? t("resendFailed")}
        </p>
      ) : null}

      {resendHidden ? null : (
        <Button
          type="button"
          variant="outline"
          disabled={cooldown > 0 || sending}
          onClick={handleResend}
          className={cn(
            "mt-6 h-12 w-full max-w-xs rounded-xl border-navy text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-60",
            isArabic ? "font-arabic text-lg" : "text-base font-semibold",
          )}
        >
          {sending ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-navy/30 border-t-navy"
                aria-hidden="true"
              />
              {t("sending")}
            </>
          ) : cooldown > 0 ? (
            t("resendIn", { seconds: cooldown })
          ) : (
            resendLabel
          )}
        </Button>
      )}

      <Button
        asChild
        className="h-12 w-full max-w-xs rounded-xl bg-navy text-lg text-white transition-colors hover:bg-navy/90 focus-ring"
      >
        <Link to="/login">
          {isArabic ? (
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          )}
          {backToLoginLabel}
        </Link>
      </Button>

      <p
        className={cn(
          "mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/80",
          isArabic ? "font-arabic text-base" : "",
        )}
      >
        {t("spamHint")}
      </p>
    </div>
  );
}
