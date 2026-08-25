import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useMarkAllRead, useNotificationSummary } from "../hooks";
import { cn } from "@/lib/utils";

/**
 * "Mark all as read" (BR-4): sweeps every visible unread row regardless
 * of the active tab or filter; disabled when there is nothing to sweep.
 */
export function MarkAllReadButton({ className }: { className?: string }) {
  const { t } = useTranslation("notifications");
  const { data } = useNotificationSummary();
  const markAllRead = useMarkAllRead();

  const unread = data?.unread_count ?? 0;

  return (
    <button
      type="button"
      disabled={markAllRead.isPending || unread === 0}
      onClick={() =>
        markAllRead.mutate(undefined, {
          onSuccess: () => toast.success(t("toast.markedAllRead")),
        })
      }
      className={cn(
        "focus-ring inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <CheckCheck className="size-4" aria-hidden="true" />
      <span>{t("actions.markAllRead")}</span>
    </button>
  );
}
