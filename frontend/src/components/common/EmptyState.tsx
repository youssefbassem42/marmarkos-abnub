import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  Icon?: LucideIcon;
  /** One-line explanation; already translated by the caller. */
  title: string;
  /** Optional call to action below the text (e.g. a reset-filters button). */
  action?: React.ReactNode;
  className?: string;
}

/** Shared empty-result block: tinted icon circle + one line of copy. */
export function EmptyState({
  Icon,
  title,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
          <Icon className="h-8 w-8 text-mint" aria-hidden="true" />
        </span>
      ) : null}
      <p className={cn("text-sm text-muted-foreground")}>{title}</p>
      {action}
    </div>
  );
}
