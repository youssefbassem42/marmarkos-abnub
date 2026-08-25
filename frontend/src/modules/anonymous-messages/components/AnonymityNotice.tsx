import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

/** The mint-tinted anonymity banner inside the submission card (R-7). */
export function AnonymityNotice() {
  const { t } = useTranslation("anonymousMessages");

  return (
    <div className="flex items-start gap-3 rounded-xl bg-mint/10 px-4 py-3">
      <ShieldCheck
        className="mt-0.5 size-5 shrink-0 text-mint"
        aria-hidden="true"
      />
      <p className="text-sm leading-relaxed text-ink">
        <strong className="font-semibold">{t("anonymityNotice.title")}</strong>
        <br />
        {t("anonymityNotice.body")}
      </p>
    </div>
  );
}
