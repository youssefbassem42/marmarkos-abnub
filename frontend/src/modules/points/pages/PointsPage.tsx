import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { PointsKpiRow } from "../components/PointsKpiRow";
import { PointsOverTimeChart } from "../components/PointsOverTimeChart";
import { MonthlyHistoryList } from "../components/MonthlyHistoryList";
import { PointsByQuizTable } from "../components/PointsByQuizTable";
import { RecentActivityList } from "../components/RecentActivityList";
import { MonthlyPointsSummary } from "../components/MonthlyPointsSummary";
import { PointsMonthSelector } from "../components/PointsMonthSelector";
import { useMyPoints, useMonthlyPoints } from "../hooks";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PointsPage() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");

  const pointsQuery = useMyPoints();
  const monthlyQuery = useMonthlyPoints();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMonth = searchParams.get("month") ?? currentMonth();

  const hasAnyPoints =
    pointsQuery.data &&
    (pointsQuery.data.lifetime > 0 ||
      pointsQuery.data.this_month > 0 ||
      pointsQuery.data.this_week > 0);

  const BackArrow = () => (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="mb-4 gap-1 font-arabic"
    >
      <Link to="/">
        <ArrowLeft className="h-4 w-4 rtl:hidden" aria-hidden="true" />
        <ArrowLeft
          className="hidden h-4 w-4 rotate-180 rtl:block"
          aria-hidden="true"
        />
        {tCommon("back")}
      </Link>
    </Button>
  );

  if (pointsQuery.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
          <BackArrow />
          <div className="space-y-6">
            <div>
              <div className="h-8 w-48 animate-pulse rounded bg-primary/10" />
              <div className="mt-1 h-4 w-72 animate-pulse rounded bg-primary/10" />
            </div>
            <PointsKpiRow data={undefined} isPending />
          </div>
        </main>
      </div>
    );
  }

  if (!hasAnyPoints) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
          <BackArrow />
          <div className="space-y-6">
            <div>
              <h1 className="font-heading text-2xl font-bold text-ink font-arabic">
                {t("page.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground font-arabic">
                {t("page.subtitle")}
              </p>
            </div>
            <EmptyState
              Icon={Trophy}
              title={t("page.empty.title")}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/bible-verses">{t("page.empty.cta")}</Link>
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
        <BackArrow />
        <div className="space-y-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink font-arabic">
              {t("page.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-arabic">
              {t("page.subtitle")}
            </p>
          </div>

          <PointsMonthSelector
            months={monthlyQuery.data?.items ?? []}
            selectedMonth={selectedMonth}
            onMonthChange={(month) => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("month", month);
                return next;
              });
            }}
            isPending={monthlyQuery.isPending}
            isDisabled={monthlyQuery.isError}
          />

          <MonthlyPointsSummary
            data={monthlyQuery.data}
            selectedMonth={selectedMonth}
            isPending={monthlyQuery.isPending}
            isError={monthlyQuery.isError}
            onRetry={() => void monthlyQuery.refetch()}
          />

          <PointsKpiRow data={pointsQuery.data} isPending={false} />

          <PointsOverTimeChart
            data={monthlyQuery.data}
            isPending={monthlyQuery.isPending}
          />

          <PointsByQuizTable />

          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyHistoryList
              data={monthlyQuery.data}
              isPending={monthlyQuery.isPending}
            />
            <RecentActivityList />
          </div>
        </div>
      </main>
    </div>
  );
}
