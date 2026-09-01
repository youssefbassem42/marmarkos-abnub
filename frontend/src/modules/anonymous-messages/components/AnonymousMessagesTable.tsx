import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MessageStatusBadge } from "./MessageStatusBadge";
import type { AnonymousMessageAdminItem } from "../types";

interface AnonymousMessagesTableProps {
  items: AnonymousMessageAdminItem[];
  onRetry: (id: string) => void;
  retryPending: boolean;
}

/** Expandable message cell: clamp to three lines until opened. */
function MessageCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const clamped = !expanded;

  return (
    <button
      type="button"
      onClick={() => setExpanded((previous) => !previous)}
      className={cn(
        "focus-ring max-w-72 rounded-sm text-start text-sm leading-relaxed",
        clamped && "line-clamp-3",
      )}
    >
      {text}
    </button>
  );
}

/**
 * The admin review table (D-11): created, message (expandable), name,
 * phone, status, Telegram status, attempts and the retry action — the
 * action renders only for rows whose Telegram forward FAILED (BR-14).
 */
export function AnonymousMessagesTable({
  items,
  onRetry,
  retryPending,
}: AnonymousMessagesTableProps) {
  const { t } = useTranslation("anonymousMessages");
  const locale = "ar-EG";
  const notProvided = t("admin.table.notProvided");

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.table.createdAt")}</TableHead>
            <TableHead>{t("admin.table.message")}</TableHead>
            <TableHead>{t("admin.table.name")}</TableHead>
            <TableHead>{t("admin.table.phone")}</TableHead>
            <TableHead>{t("admin.table.status")}</TableHead>
            <TableHead>{t("admin.table.telegram")}</TableHead>
            <TableHead className="text-center">
              {t("admin.table.attempts")}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(item.created_at))}
              </TableCell>
              <TableCell>
                <MessageCell text={item.message} />
              </TableCell>
              <TableCell className="text-sm font-arabic">
                {item.sender_name ?? (
                  <span className="text-muted-foreground">{notProvided}</span>
                )}
              </TableCell>
              <TableCell dir="ltr" className="whitespace-nowrap text-sm">
                {item.sender_phone ?? (
                  <span className="text-muted-foreground">{notProvided}</span>
                )}
              </TableCell>
              <TableCell>
                <StatusWithReason
                  status={item.status}
                  reason={item.failure_reason}
                />
              </TableCell>
              <TableCell>
                <TelegramStatus status={item.telegram_status} />
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {new Intl.NumberFormat(locale).format(item.attempts)}
              </TableCell>
              <TableCell>
                {item.telegram_status === "FAILED" && (
                  <button
                    type="button"
                    disabled={retryPending}
                    onClick={() => onRetry(item.id)}
                    className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {t("admin.retry.action")}
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusWithReason({
  status,
  reason,
}: {
  status: AnonymousMessageAdminItem["status"];
  reason: string | null;
}) {
  const tooltipId = useId();

  return (
    <span className="inline-flex items-center gap-1">
      <span aria-describedby={reason ? tooltipId : undefined}>
        <MessageStatusBadge status={status} />
      </span>
      {reason && (
        <>
          <span id={tooltipId} role="tooltip" className="sr-only">
            {reason}
          </span>
          <span
            tabIndex={0}
            aria-hidden="true"
            title={reason}
            className="cursor-help text-xs font-bold text-status-absent"
          >
            !
          </span>
        </>
      )}
    </span>
  );
}

function TelegramStatus({
  status,
}: {
  status: AnonymousMessageAdminItem["telegram_status"];
}) {
  return <MessageStatusBadge status={status} />;
}
