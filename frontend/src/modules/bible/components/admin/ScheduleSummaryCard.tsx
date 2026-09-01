import { useTranslation } from "react-i18next";
import { Calendar, Clock, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScheduleSummaryCardProps {
  date: string;
  time: string;
}

export function ScheduleSummaryCard({ date, time }: ScheduleSummaryCardProps) {
  const { t, i18n } = useTranslation("bible");

  if (!date || !time) return null;

  const scheduledAt = new Date(`${date}T${time}:00`);
  const locale = i18n.language;

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    scheduledAt,
  );
  const fullDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(scheduledAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t("admin.schedule.summary.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">
              {t("admin.schedule.summary.weekday")}
            </p>
            <p className="font-medium">{weekday}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">
              {t("admin.schedule.summary.date")}
            </p>
            <p className="font-medium">{fullDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">
              {t("admin.schedule.summary.time")}
            </p>
            <p className="font-medium">{time}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">
              {t("admin.schedule.summary.timezone")}
            </p>
            <p className="font-medium">Africa/Cairo (GMT+2)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
