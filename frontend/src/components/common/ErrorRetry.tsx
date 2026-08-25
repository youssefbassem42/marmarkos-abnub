import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ErrorRetryProps {
  onRetry: () => void;
  /** Override the label; defaults to common.retry. */
  label?: string;
  className?: string;
}

/** Shared load-failure block: one full-width retry button. */
export function ErrorRetry({ onRetry, label, className }: ErrorRetryProps) {
  const { t } = useTranslation("common");

  return (
    <button
      type="button"
      onClick={onRetry}
      className={cn(
        "focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 text-status-absent" aria-hidden="true" />
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      {label ?? t("retry")}
    </button>
  );
}
