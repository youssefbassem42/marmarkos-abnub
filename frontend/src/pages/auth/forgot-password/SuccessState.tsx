import { useTranslation } from "react-i18next";
import { CheckEmailCard } from "../components/CheckEmailCard";
import { requestPasswordReset } from "@/lib/api";

interface SuccessStateProps {
  lang: "ar" | "en";
  email?: string;
}

/**
 * Standard "check your mail" layout (shared with the verification
 * flow) showing the reset-link confirmation with a resend option.
 */
export function SuccessState({ lang, email }: SuccessStateProps) {
  const { t } = useTranslation("forgotPassword");

  return (
    <CheckEmailCard
      lang={lang}
      email={email}
      title={t("validation.successTitle")}
      description={t("validation.successMessage")}
      resendLabel={t("form.cta")}
      onResend={() => {
        if (!email) return Promise.reject(new Error("missing email"));
        return requestPasswordReset({ email });
      }}
      backToLoginLabel={t("validation.successLogin")}
    />
  );
}
