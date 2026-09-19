import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { formatMonthYear } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonthlyPointsResponse } from "../types";

interface MonthlyHistoryListProps {
  data: MonthlyPointsResponse[] | undefined;
  isPending: boolean;
}

const INITIAL_COUNT = 6;

export function MonthlyHistoryList({ data, isPending }: MonthlyHistoryListProps) {
  const { t } = useTranslation("points");
  const [expanded, setExpanded] = useState(false);
  const locale = "ar-EG";

  if (isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const months = data ?? [];
  const visibleMonths = expanded ? months : months.slice(0, INITIAL_COUNT);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
      <h2 className="font-heading text-lg font-bold text-ink font-arabic">
        {t("page.history")}
      </h2>

      {months.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("page.empty.title")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشهر</TableHead>
                <TableHead className="text-end">{t("page.overTime")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMonths.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium text-ink font-arabic">
                    {formatMonthYear(row.month + "-01", locale)}
                  </TableCell>
                  <TableCell className="text-end" dir="ltr" tabular-nums>
                    {new Intl.NumberFormat(locale).format(row.points)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {months.length > INITIAL_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          {expanded ? t("page.history") : t("page.viewAllHistory")}
        </button>
      )}
    </div>
  );
}
