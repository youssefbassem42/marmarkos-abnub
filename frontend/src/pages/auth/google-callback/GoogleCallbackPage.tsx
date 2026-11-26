import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { useApiError } from "@/hooks/useApiError";
import { getMe, scheduleTokenRefresh } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Phase = "working" | "done" | "failed";

/**
 * Landing spot after the Google OAuth redirect flow. The backend sends the
 * browser here with the access token in the URL fragment (#...) so it never
 * touches server logs; we then load the profile and continue.
 */
export function GoogleCallbackPage() {
  const { t } = useTranslation("login");
  const describeError = useApiError();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const error = hash.get("error");
    const accessToken = hash.get("access_token");
    const expiresIn = Number(hash.get("expires_in") ?? 0);

    if (error || !accessToken) {
      /*
        Every answer of the backend has its own sentence: the member
        must know whether Google is not configured, whether the account
        is closed, whether he cancelled, or whether the attempt simply
        expired. One sentence for all of them hides the truth.
      */
      const message = (() => {
        switch (error) {
          case "not_configured":
            return t("google.notConfigured");
          case "account_inactive":
            return t("google.accountInactive");
          case "identity_failed":
            return t("google.identityFailed");
          case "invalid_state":
            return t("google.invalidState");
          case "access_denied":
            return t("google.accessDenied");
          default:
            return t("google.failed");
        }
      })();
      setErrorMessage(message);
      setPhase("failed");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const user = await getMe(accessToken);
        if (cancelled) return;
        // The refresh cookie was set by the backend on this origin (the
        // rewrite of the frontend forwards the callback to the API).
        saveAuth({ accessToken, user }, true);
        // The session must outlive the access token (the proactive
        // refresh).
        if (Number.isFinite(expiresIn) && expiresIn > 0) {
          scheduleTokenRefresh(expiresIn);
        }
        if (!user.date_of_birth || !user.address) {
          navigate("/profile", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(describeError(err).message);
        setPhase("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [describeError, location.hash, navigate, t]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col items-center justify-center gap-4 px-5 text-center">
        {phase === "working" ? (
          <>
            <Loader2
              className="h-10 w-10 animate-spin text-mint"
              aria-hidden="true"
            />
            <p className={cn("text-muted-foreground font-arabic text-lg")}>
              {t("google.working")}
            </p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-brand-red" aria-hidden="true" />
            <p className={cn("text-ink font-arabic text-xl")}>
              {errorMessage ?? t("google.failed")}
            </p>
            <Button
              asChild
              className="h-11 rounded-xl bg-navy px-6 text-white hover:bg-navy/90 focus-ring"
            >
              <Link to="/login">{t("form.backToLogin")}</Link>
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
