import { useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateOrEmpty } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePointsByQuiz } from "../hooks";
import type { PointsByQuizParams } from "../types";

const SIZE = 20;
const locale = "ar-EG";

export function PointsByQuizTable({
  params,
}: {
  params?: PointsByQuizParams;
} = {}) {
  const { t } = useTranslation("points");
  const [page, setPage] = useState(1);

  const query = usePointsByQuiz({ ...params, page, size: SIZE });

  const card = (children: React.ReactNode) => (
    <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
      <h2 className="font-heading text-lg font-bold text-ink font-arabic">
        {t("page.byQuiz.title")}
      </h2>
      {children}
    </div>
  );

  if (query.isPending) {
    return card(
      <div className="mt-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>,
    );
  }

  if (query.isError) {
    return card(
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <ErrorRetry onRetry={() => query.refetch()} />
      </div>,
    );
  }

  const data = query.data;
  const items = data?.items ?? [];
  const totalPoints = data?.total_points ?? 0;

  if (items.length === 0) {
    return card(
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
          <Trophy className="h-8 w-8 text-mint" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">
          {t("page.byQuiz.empty")}
        </p>
      </div>,
    );
  }

  return card(
    <>
      <p className="mt-1 text-sm text-muted-foreground font-arabic">
        {t("page.byQuiz.totalPoints", {
          total: new Intl.NumberFormat(locale).format(totalPoints),
        })}
      </p>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("page.byQuiz.quiz")}</TableHead>
              <TableHead className="text-end">
                {t("page.byQuiz.points")}
              </TableHead>
              <TableHead className="text-end">
                {t("page.byQuiz.attempts")}
              </TableHead>
              <TableHead className="text-end">
                {t("page.byQuiz.average")}
              </TableHead>
              <TableHead>{t("page.byQuiz.lastAttempt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.quiz_id}>
                <TableCell className="font-medium text-ink font-arabic">
                  {item.quiz_title}
                </TableCell>
                <TableCell className="text-end" dir="ltr" tabular-nums>
                  {new Intl.NumberFormat(locale).format(item.points)}
                </TableCell>
                <TableCell className="text-end" dir="ltr" tabular-nums>
                  {new Intl.NumberFormat(locale).format(item.attempts)}
                </TableCell>
                <TableCell className="text-end" dir="ltr" tabular-nums>
                  {`${new Intl.NumberFormat(locale).format(
                    item.average_score_out_of_10,
                  )} / 10`}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground font-arabic">
                  {formatDateOrEmpty(item.last_attempt_at, {
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-6 flex justify-end">
        {data && (
          <AppPagination
            page={data.page}
            pages={data.pages}
            onPageChange={setPage}
          />
        )}
      </div>
    </>,
  );
}
