import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  useVerse,
  useScheduleVerse,
  useRescheduleVerse,
  useCancelSchedule,
} from "../../hooks";
import { ScheduleForm } from "../../components/admin/ScheduleForm";
import { AlreadyScheduledCard } from "../../components/admin/AlreadyScheduledCard";
import type { ScheduleFormValues } from "../../components/admin/scheduleSchema";

export default function VerseSchedulePage() {
  const { verseId } = useParams<{ verseId: string }>();
  const { t } = useTranslation("bible");
  const { t: tAdmin } = useTranslation("admin");
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  const { data: verse, isLoading: verseLoading } = useVerse(verseId ?? "", {
    enabled: Boolean(verseId),
  });

  const scheduleMutation = useScheduleVerse();
  const rescheduleMutation = useRescheduleVerse();
  const cancelMutation = useCancelSchedule();

  const isLoading =
    scheduleMutation.isPending ||
    rescheduleMutation.isPending ||
    cancelMutation.isPending;

  const existingSchedule = verse?.schedule;
  const isAlreadyScheduled = existingSchedule?.status === "SCHEDULED";
  const isPublished = verse?.status === "PUBLISHED";

  const handleSchedule = useCallback(
    (data: ScheduleFormValues) => {
      if (!verseId) return;

      const scheduledAt = `${data.date}T${data.time}:00`;

      if (isAlreadyScheduled && existingSchedule) {
        rescheduleMutation.mutate(
          { verseId, data: { scheduled_at: scheduledAt } },
          {
            onSuccess: () => {
              toast.success(t("admin.schedule.rescheduled"));
              navigate("/admin/bible-verses");
            },
            onError: () => {
              toast.error(t("admin.schedule.saveFailed"));
            },
          },
        );
      } else {
        scheduleMutation.mutate(
          { verseId, data: { scheduled_at: scheduledAt } },
          {
            onSuccess: () => {
              toast.success(t("admin.schedule.saved"));
              navigate("/admin/bible-verses");
            },
            onError: () => {
              toast.error(t("admin.schedule.saveFailed"));
            },
          },
        );
      }
    },
    [
      verseId,
      isAlreadyScheduled,
      existingSchedule,
      scheduleMutation,
      rescheduleMutation,
      t,
      navigate,
    ],
  );

  const handleCancel = useCallback(() => {
    if (!verseId) return;
    cancelMutation.mutate(verseId, {
      onSuccess: () => {
        toast.success(t("admin.schedule.cancelled"));
        navigate("/admin/bible-verses");
      },
    });
  }, [verseId, cancelMutation, t, navigate]);

  if (verseLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ar">
      <AdminTopbar
        title={t("admin.schedule.title")}
        subtitle={t("admin.schedule.subtitle")}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-6 lg:px-8">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin">{tAdmin("nav.dashboard")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin/bible-verses">
                {tAdmin("nav.bibleVerses")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {t("admin.schedule.title")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/bible-verses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {t("admin.schedule.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("admin.schedule.subtitle")}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            <Check className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium">
            {t("admin.schedule.steps.step1")}
          </span>
        </div>
        <Separator className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
              activeStep === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {activeStep === 2 ? (
              <span>2</span>
            ) : (
              <span>2</span>
            )}
          </div>
          <span className="text-sm font-medium">
            {t("admin.schedule.steps.step2")}
          </span>
        </div>
      </div>

      {/* Selected Verse Card */}
      {verse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t("admin.schedule.steps.step1")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{verse.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {verse.verse_reference}
                </p>
                <Badge variant="secondary">{verse.book}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/admin/bible-verses/${verseId}/edit`)}
              >
                {t("admin.actions.edit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Already Scheduled Warning */}
      {isAlreadyScheduled && existingSchedule && (
        <AlreadyScheduledCard
          schedule={existingSchedule}
          onReschedule={() => setActiveStep(2)}
          onCancel={handleCancel}
          isCancelling={cancelMutation.isPending}
        />
      )}

      {isPublished && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
          {t("admin.schedule.already.published")}
        </div>
      )}

      {/* Schedule Form */}
      {!isAlreadyScheduled && !isPublished && (
        <ScheduleForm onSubmit={handleSchedule} isLoading={isLoading} />
      )}
      </main>
    </div>
  );
}
