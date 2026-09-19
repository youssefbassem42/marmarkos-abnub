import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, ChevronLeft } from "lucide-react";
import { formatTimeAgo } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { AppPagination } from "@/components/common/AppPagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePointsHistory } from "../hooks";

const INITIAL_COUNT = 5;

export function RecentActivityList() {
  const { t } = useTranslation("points");
  const locale = "ar-EG";
  const [expanded, setExpanded] = useState(false);

  const query = usePointsHistory({ page: 1, size: expanded ? 50 : INITIAL_COUNT });

  const items = query.data?.items ?? [];

  if (query.isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
      <h2 className="font-heading text-lg font-bold text-ink font-arabic">
        {t("page.activity")}
      </h2>

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
            <Activity className="h-8 w-8 text-mint" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">{t("page.empty.title")}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المصدر</TableHead>
                  <TableHead className="text-end">
                    {t("page.lifetime")}
                  </TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-ink font-arabic">
                      {item.quiz_title ?? item.source}
                    </TableCell>
                    <TableCell className="text-end" dir="ltr" tabular-nums>
                      +{new Intl.NumberFormat(locale).format(item.points)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground font-arabic">
                      {formatTimeAgo(item.awarded_at, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
            {expanded ? t("page.activity") : t("page.viewAllActivity")}
          </button>
        </>
      )}
    </div>
  );
}
