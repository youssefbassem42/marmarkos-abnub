import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  Icon: LucideIcon;
  iconClassName: string;
  value: number;
  label: string;
  /** Explains provisional numbers, e.g. the absence cutoff (BR-5). */
  title?: string;
  size?: "sm" | "lg";
}

/** Icon medallion + locale-formatted value + label. */
export function StatTile({
  Icon,
  iconClassName,
  value,
  label,
  title,
  size = "sm",
}: StatTileProps) {
  const formatted = new Intl.NumberFormat("ar-EG").format(value);

  return (
    <div
      title={title}
      aria-description={title}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-center",
        size === "lg" && "p-6",
      )}
    >
      <Icon
        className={cn(
          "mx-auto h-6 w-6",
          iconClassName,
          size === "lg" && "h-8 w-8",
        )}
        aria-hidden="true"
      />
      <p
        className={cn(
          "mt-2 font-heading text-3xl font-bold text-ink",
          size === "lg" && "text-4xl",
        )}
      >
        {formatted}
      </p>
      <p
        className={cn(
          "text-xs font-medium text-muted-foreground",
          size === "lg" && "text-sm",
        )}
      >
        {label}
      </p>
    </div>
  );
}
