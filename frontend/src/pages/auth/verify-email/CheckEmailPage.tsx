import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/layout/Navbar";
import { AuthFooter } from "../components/AuthFooter";
import { BrandPanel } from "../components/BrandPanel";
import { CheckEmailCard } from "../components/CheckEmailCard";
import { resendVerificationEmail } from "@/lib/api";

/**
 * Step after registration (or an unverified login attempt): the account
 * is created but inactive until the emailed link is confirmed. Offers a
 * resend with cooldown — the standard "check your mail" layout.
 */
export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? undefined;
  const { t } = useTranslation("verification");

  useEffect(() => {
    document.title = t("checkEmail.title");
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
            <CheckEmailCard
              lang="ar"
              email={email}
              title={t("checkEmail.heading")}
              description={
                email
                  ? t("checkEmail.descriptionWithEmail")
                  : t("checkEmail.description")
              }
              note={t("checkEmail.note")}
              resendLabel={t("checkEmail.resend")}
              resendHidden={!email}
              onResend={() => {
                if (!email) return Promise.reject(new Error("missing email"));
                return resendVerificationEmail(email);
              }}
              backToLoginLabel={t("checkEmail.backToLogin")}
            />
          </div>
        </section>
      </main>

      <AuthFooter lang="ar" />
    </div>
  );
}
