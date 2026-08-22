import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, QrCode, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mint tips panel + composed phone-with-check illustration. Hidden below sm. */
export function ScanTips() {
  const { t } = useTranslation("attendance");
  const isArabic = document.documentElement.dir === "rtl";
  const items = t("checkIn.tips.items", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <div
      className={cn(
        "hidden gap-4 rounded-xl border border-mint/30 bg-mint/10 p-4 sm:flex",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-bold text-mint">
          <Info className="h-4 w-4" aria-hidden="true" />
          {t("checkIn.tips.title")}
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/80">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div
        className="relative flex w-20 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <Smartphone className="h-16 w-16 text-navy" strokeWidth={1.5} />
        <QrCode className="absolute h-6 w-6 text-navy/70 top-3" />
        <CheckCircle2 className="absolute bottom-2 h-7 w-7 rounded-full bg-mint fill-mint text-white end-0" />
      </div>
    </div>
  );
}
