import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { PointsKpiRow } from "../components/PointsKpiRow";
import { PointsOverTimeChart } from "../components/PointsOverTimeChart";
import { MonthlyHistoryList } from "../components/MonthlyHistoryList";
import { RecentActivityList } from "../components/RecentActivityList";
import {
  useMyPoints,
  useMonthlyPoints,
} from "../hooks";

export default function PointsPage() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");

  const pointsQuery = useMyPoints();
  const monthlyQuery = useMonthlyPoints();

  const hasAnyPoints =
    pointsQuery.data &&
    (pointsQuery.data.total_points > 0 ||
      pointsQuery.data.this_month_points > 0 ||
      pointsQuery.data.this_week_points > 0);

  const BackArrow = () => (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="mb-4 gap-1 font-arabic"
    >
      <Link to="/">
        <ArrowLeft
          className="h-4 w-4 rtl:hidden"
          aria-hidden="true"
        />
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
      <div dir="rtl" lang="ar" className="min-h-screen bg-background">
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
      <div dir="rtl" lang="ar" className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
          <BackArrow />
          <div className="space-y-6">
            <div>
              <h1
                className="font-heading text-2xl font-bold text-ink font-arabic"
              >
                {t("page.title")}
              </h1>
              <p
                className="mt-1 text-sm text-muted-foreground font-arabic"
              >
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
    <div dir="rtl" lang="ar" className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-5 pt-28 pb-16 lg:px-8">
        <BackArrow />
        <div className="space-y-6">
          <div>
            <h1
              className="font-heading text-2xl font-bold text-ink font-arabic"
            >
              {t("page.title")}
            </h1>
            <p
              className="mt-1 text-sm text-muted-foreground font-arabic"
            >
              {t("page.subtitle")}
            </p>
          </div>

          <PointsKpiRow data={pointsQuery.data} isPending={false} />

          <PointsOverTimeChart
            data={monthlyQuery.data}
            isPending={monthlyQuery.isPending}
          />

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
