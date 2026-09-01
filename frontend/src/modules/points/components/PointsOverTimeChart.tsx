import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthlyPointsResponse } from "../types";

type Range = 3 | 6 | 12;

const RANGE_OPTIONS: Range[] = [3, 6, 12];

interface PointsOverTimeChartProps {
  data: MonthlyPointsResponse[] | undefined;
  isPending: boolean;
}

export function PointsOverTimeChart({ data, isPending }: PointsOverTimeChartProps) {
  const { t } = useTranslation("points");
  const locale = "ar-EG";

  const [range, setRange] = useState<Range>(6);

  const chartData = useMemo(() => {
    if (!data) return [];
    const sliced = data.slice(-range);
    return [...sliced].reverse();
  }, [data, range]);

  const rangeLabels: Record<Range, string> = {
    3: t("page.range.thisMonth"),
    6: t("page.range.allTime"),
    12: t("page.range.allTime"),
  };

  if (isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="mt-4 h-[260px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="font-heading text-lg font-bold text-ink font-arabic"
        >
          {t("page.overTime")}
        </h2>
        <div className="flex gap-1" role="radiogroup" aria-label={t("page.overTime")}>
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {r}M
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("page.empty.title")}
        </p>
      ) : (
        <div className="mt-4 h-[260px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="month_label"
                tickLine={false}
                axisLine={false}
                reversed
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                orientation="right"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0];
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-ink">
                        {point.payload?.month_label as string}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {new Intl.NumberFormat(locale).format(
                          (point.value as number) ?? 0,
                        )}{" "}
                        pts
                      </p>
                    </div>
                  );
                }}
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
              />
              <Line
                type="monotone"
                dataKey="points"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ fill: "var(--chart-1)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
