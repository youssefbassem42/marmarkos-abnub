import { useTranslation } from "react-i18next";
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

export function MonthlyHistoryList({ data, isPending }: MonthlyHistoryListProps) {
  const { t } = useTranslation("points");
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
      <h2
        className="font-heading text-lg font-bold text-ink font-arabic"
      >
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
              {months.map((row) => (
                <TableRow key={row.month}>
                  <TableCell
                    className="font-medium text-ink font-arabic"
                  >
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
    </div>
  );
}
