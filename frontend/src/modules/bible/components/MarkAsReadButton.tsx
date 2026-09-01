import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MarkAsReadButtonProps {
  isRead: boolean;
  onMarkAsRead: () => void;
  isPending: boolean;
}

export function MarkAsReadButton({
  isRead,
  onMarkAsRead,
  isPending,
}: MarkAsReadButtonProps) {
  const { t } = useTranslation("bible");

  if (isRead) {
    return (
      <div
        className="flex items-center gap-2 text-sm font-medium text-mint font-arabic"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {t("detail.markedAsRead")}
      </div>
    );
  }

  return (
    <Button
      onClick={onMarkAsRead}
      disabled={isPending}
      className="font-arabic"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {t("detail.markAsRead")}
    </Button>
  );
}
