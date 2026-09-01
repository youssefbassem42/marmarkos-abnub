import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutosaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "failed";
}

export function AutosaveIndicator({ status }: AutosaveIndicatorProps) {
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");

  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        status === "saved" && "text-green-600 dark:text-green-400",
        status === "saving" && "text-muted-foreground",
        status === "failed" && "text-destructive",
      )}
      aria-live="polite"
    >
      {status === "saving" && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      )}
      {status === "saved" && <Check className="h-3.5 w-3.5" />}
      {status === "failed" && <AlertCircle className="h-3.5 w-3.5" />}
      <span>
        {status === "saving" && t("take.submitting")}
        {status === "saved" && t("take.autosaveNote")}
        {status === "failed" && tCommon("errors.unknown")}
      </span>
    </div>
  );
}
