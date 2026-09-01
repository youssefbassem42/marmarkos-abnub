import { useTranslation } from "react-i18next";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VerseScheduleBrief } from "../../types";

interface AlreadyScheduledCardProps {
  schedule: VerseScheduleBrief;
  onReschedule: () => void;
  onCancel: () => void;
  isCancelling?: boolean;
}

export function AlreadyScheduledCard({
  schedule,
  onReschedule,
  onCancel,
  isCancelling,
}: AlreadyScheduledCardProps) {
  const { t, i18n } = useTranslation("bible");
  const locale = i18n.language;

  const scheduledAt = new Date(schedule.scheduled_at);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
    scheduledAt,
  );
  const fullDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(scheduledAt);
  const timeStr = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(scheduledAt);

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          {t("admin.schedule.already.scheduled")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {weekday}, {fullDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{timeStr}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReschedule}>
            {t("admin.schedule.reschedule")}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isCancelling}>
                {t("admin.schedule.cancelSchedule")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("admin.schedule.cancelConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.schedule.cancelConfirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("admin.schedule.cancelCancel")}
                </AlertDialogCancel>
                <AlertDialogAction onClick={onCancel}>
                  {t("admin.schedule.cancelConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
