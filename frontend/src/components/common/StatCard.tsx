import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneMap: Record<string, string> = {
  default: "bg-muted/50",
  success: "bg-emerald-500/10",
  warning: "bg-amber-500/10",
  danger: "bg-destructive/10",
};

const iconToneMap: Record<string, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-destructive",
};

export function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  const formattedValue =
    typeof value === "number"
      ? new Intl.NumberFormat().format(value)
      : value;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-lg",
            toneMap[tone],
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              iconToneMap[tone],
              iconClassName,
            )}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p
            className="text-2xl font-semibold leading-tight tabular-nums"
            dir="ltr"
          >
            {formattedValue}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
