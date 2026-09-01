import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { ApiError, getMe } from "@/lib/api";
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
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const error = hash.get("error");
    const accessToken = hash.get("access_token");

    if (error || !accessToken) {
      setErrorMessage(
        error === "not_configured"
          ? "تسجيل الدخول عبر Google غير مُهيأ بعد."
          : error === "account_inactive"
            ? "هذا الحساب غير نشط. تواصل مع الإدارة."
            : error === "identity_failed"
              ? "لم نتمكن من التحقق من حساب Google (تحقق من تأكيد البريد الإلكتروني)."
              : null,
      );
      setPhase("failed");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const user = await getMe(accessToken);
        if (cancelled) return;
        // The refresh cookie was set by the backend on the API domain.
        saveAuth({ accessToken, user }, true);
        if (!user.date_of_birth || !user.address) {
          navigate("/profile", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof ApiError && err.status === 403
            ? "الحساب غير نشط."
            : null,
        );
        setPhase("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.hash, navigate]);

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-background"
    >
      <Navbar variant="auth" />

      <main className="flex min-h-[calc(100vh-61px)] flex-col items-center justify-center gap-4 px-5 text-center">
        {phase === "working" ? (
          <>
            <Loader2
              className="h-10 w-10 animate-spin text-mint"
              aria-hidden="true"
            />
            <p
              className={cn(
                "text-muted-foreground font-arabic text-lg",
              )}
            >
              جارٍ إكمال تسجيل الدخول...
            </p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-brand-red" aria-hidden="true" />
            <p
              className={cn(
                "text-ink font-arabic text-xl",
              )}
            >
              {errorMessage ??
                "تعذّر إكمال تسجيل الدخول عبر Google."}
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
