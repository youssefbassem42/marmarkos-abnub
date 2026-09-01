import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";

interface PointsProgressBarsProps {
  weekPoints: number;
  monthPoints: number;
  lifetimePoints: number;
}

export function PointsProgressBars({
  weekPoints,
  monthPoints,
  lifetimePoints,
}: PointsProgressBarsProps) {
  const { t } = useTranslation("quiz");

  const entries = [
    {
      label: t("result.progress.week"),
      earned: weekPoints,
      max: Math.max(weekPoints, 100),
      color: "bg-emerald-500",
    },
    {
      label: t("result.progress.month"),
      earned: monthPoints,
      max: Math.max(monthPoints, 500),
      color: "bg-primary",
    },
    {
      label: t("result.progress.lifetime"),
      earned: lifetimePoints,
      max: Math.max(lifetimePoints, 1000),
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const pct = entry.max > 0 ? (entry.earned / entry.max) * 100 : 0;
        return (
          <div key={entry.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{entry.label}</span>
              <span className="text-muted-foreground">{entry.earned}</span>
            </div>
            <div className="rtl:-scale-x-100">
              <Progress value={pct}>
                <div
                  className={`h-full rounded-full transition-all ${entry.color}`}
                  style={{ width: `${pct}%` }}
                />
              </Progress>
            </div>
          </div>
        );
      })}
    </div>
  );
}
