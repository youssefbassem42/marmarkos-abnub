import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthYear } from "@/lib/datetime";
import type { MonthlyPointsItem } from "../types";

interface PointsMonthSelectorProps {
  months: MonthlyPointsItem[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  isPending: boolean;
  isDisabled?: boolean;
}

const LOCALE = "ar-EG";

/** The select only offers the months in which the member earned points. */
export function PointsMonthSelector({
  months,
  selectedMonth,
  onMonthChange,
  isPending,
  isDisabled = false,
}: PointsMonthSelectorProps) {
  const { t } = useTranslation("points");

  const availableMonths = months
    .filter((month) => month.points > 0)
    .map((month) => ({
      value: month.period_month.slice(0, 7),
      label: formatMonthYear(month.period_month, LOCALE),
    }))
    .filter(
      (month, index, all) =>
        all.findIndex((candidate) => candidate.value === month.value) === index,
    )
    .sort((left, right) => right.value.localeCompare(left.value));

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Label
        htmlFor="points-month"
        className="font-arabic text-sm font-medium text-ink"
      >
        {t("page.month.selectorLabel")}
      </Label>
      <Select
        value={selectedMonth}
        onValueChange={onMonthChange}
        disabled={isDisabled || availableMonths.length === 0}
      >
        <SelectTrigger
          id="points-month"
          aria-label={t("page.month.selectorLabel")}
          className="w-full focus-ring sm:w-64"
        >
          <SelectValue
            placeholder={
              availableMonths.length === 0
                ? t("page.month.noMonths")
                : t("page.month.selectorLabel")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {availableMonths.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
