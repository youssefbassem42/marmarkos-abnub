import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MeetingBadge = "open" | "closed" | "notHeld";

interface MeetingSelectorProps {
  year: number;
  month: number;
  /** Selected meeting (YYYY-MM-DD); undefined = the open meeting. */
  selected?: string;
  meetings: string[];
  openMeetingDate: string;
  onSelect: (meetingDate: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

const MONTH_NAMES_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthOptions(currentYear: number) {
  const options: { year: number; month: number }[] = [];
  for (let offset = -6; offset <= 6; offset++) {
    const date = new Date(
      Date.UTC(currentYear, new Date().getUTCMonth() + offset, 1),
    );
    options.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    });
  }
  return options;
}

/** Previous/next arrows + month select fed by the meeting schedule API. */
export function MeetingSelector({
  year,
  month,
  selected,
  meetings,
  openMeetingDate,
  onSelect,
  onMonthChange,
}: MeetingSelectorProps) {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  // Arrows mirror with direction, not CSS transforms.
  const PrevIcon = isArabic ? ChevronRight : ChevronLeft;
  const NextIcon = isArabic ? ChevronLeft : ChevronRight;

  const selectedIndex = selected
    ? meetings.indexOf(selected)
    : meetings.indexOf(openMeetingDate);
  const hasPrevious = selectedIndex > 0;
  const hasNext =
    selectedIndex >= 0 && selectedIndex < meetings.length - 1
      ? meetings[selectedIndex + 1] <= openMeetingDate
      : false;

  const months = monthOptions(year);
  const monthNames = isArabic ? MONTH_NAMES_AR : MONTH_NAMES_EN;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t("dashboard.meeting.previous")}
        disabled={!hasPrevious}
        onClick={() => hasPrevious && onSelect(meetings[selectedIndex - 1])}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PrevIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <Select
        value={`${year}-${month}`}
        onValueChange={(value) => {
          const [y, m] = value.split("-").map(Number);
          onMonthChange(y, m);
        }}
      >
        <SelectTrigger
          aria-label={t("dashboard.meeting.selectorLabel")}
          className="h-9 w-[190px] rounded-lg border-border bg-card focus-ring"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map(({ year: y, month: m }) => (
            <SelectItem key={`${y}-${m}`} value={`${y}-${m}`}>
              {monthNames[m - 1]} {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        aria-label={t("dashboard.meeting.next")}
        disabled={!hasNext}
        onClick={() => hasNext && onSelect(meetings[selectedIndex + 1])}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <NextIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <span
        className={cn(
          "ms-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          !selected || selected === openMeetingDate
            ? "border-mint/40 bg-mint/15 text-emerald-700"
            : selected > openMeetingDate
              ? "border-border bg-muted text-muted-foreground"
              : "border-status-late/30 bg-status-late/10 text-status-late",
        )}
      >
        {!selected || selected === openMeetingDate
          ? t("dashboard.meeting.open")
          : selected > openMeetingDate
            ? t("dashboard.meeting.notHeld")
            : t("dashboard.meeting.closed")}
      </span>
    </div>
  );
}
