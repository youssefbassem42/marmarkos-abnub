import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Form } from "@/components/ui/form";
import { useVerse, useCreateVerse, useUpdateVerse, usePublishVerse } from "../../hooks";
import { VerseForm } from "../../components/admin/VerseForm";
import { createVerseSchema, type VerseFormValues } from "../../components/admin/verseSchema";

export default function VerseFormPage() {
  const { verseId } = useParams<{ verseId: string }>();
  const isEdit = Boolean(verseId);
  const { t } = useTranslation("bible");
  const { t: tAdmin } = useTranslation("admin");
  const navigate = useNavigate();

  const { data: verse, isLoading: verseLoading } = useVerse(verseId ?? "", {
    enabled: isEdit,
  });

  const createMutation = useCreateVerse();
  const updateMutation = useUpdateVerse();
  const publishMutation = usePublishVerse();

  const schema = createVerseSchema(t);

  const form = useForm<VerseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      subtitle: "",
      verseReference: "",
      book: "",
      chapter: 1,
      verseStart: 1,
      verseEnd: null,
      text: "",
      reflection: "",
      image: "",
      translation: "NIV",
      status: "DRAFT",
    },
  });

  // Prefill form when editing
  useEffect(() => {
    if (verse && isEdit) {
      form.reset({
        title: verse.title,
        subtitle: verse.subtitle ?? "",
        verseReference: verse.verse_reference,
        book: verse.book,
        chapter: verse.chapter,
        verseStart: verse.verse_start,
        verseEnd: verse.verse_end ?? null,
        text: verse.text,
        reflection: verse.reflection,
        image: verse.image ?? "",
        translation: verse.translation,
        status: verse.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      });
    }
  }, [verse, isEdit, form]);

  // Unsaved changes guard
  const isDirty = form.formState.isDirty;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSaving) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSaving]);

  const saveVerse = useCallback(
    async (data: VerseFormValues) => {
      const payload = {
        title: data.title,
        subtitle: data.subtitle || undefined,
        verse_reference: data.verseReference,
        book: data.book,
        chapter: data.chapter,
        verse_start: data.verseStart,
        verse_end: data.verseEnd ?? undefined,
        text: data.text,
        reflection: data.reflection || "",
        image: data.image || undefined,
        translation: data.translation || "NIV",
      };

      if (isEdit && verseId) {
        return updateMutation.mutateAsync({ verseId, data: payload });
      }
      return createMutation.mutateAsync(payload);
    },
    [isEdit, verseId, createMutation, updateMutation],
  );

  const handleSaveDraft = form.handleSubmit(async (data) => {
    try {
      const saved = await saveVerse({ ...data, status: "DRAFT" });
      toast.success(t("admin.form.saved"));
      if (!isEdit && saved) {
        navigate(`/admin/bible-verses/${saved.id}/edit`, { replace: true });
      }
      form.reset(form.getValues());
    } catch {
      toast.error(t("admin.form.saveFailed"));
    }
  });

  const handleSchedule = form.handleSubmit(async (data) => {
    try {
      const saved = await saveVerse(data);
      if (saved) {
        navigate(`/admin/bible-verses/${saved.id}/schedule`);
      }
    } catch {
      toast.error(t("admin.form.saveFailed"));
    }
  });

  const handlePublish = form.handleSubmit(async (data) => {
    try {
      const saved = await saveVerse({ ...data, status: "PUBLISHED" });
      if (saved) {
        if (isEdit) {
          await publishMutation.mutateAsync(saved.id);
        }
        toast.success(t("admin.form.published"));
        navigate("/admin/bible-verses");
      }
    } catch {
      toast.error(t("admin.form.publishFailed"));
    }
  });

  if (verseLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminTopbar
        title={isEdit ? t("admin.form.edit") : t("admin.form.create")}
        subtitle={t("admin.form.title")}
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
              {isEdit
                ? t("admin.form.edit")
                : t("admin.form.create")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/bible-verses">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit
                ? t("admin.form.edit")
                : t("admin.form.create")}
            </h1>
          </div>
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("admin.form.saveDraft")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSchedule}
            disabled={isSaving}
          >
            <Calendar className="h-4 w-4" />
            {t("admin.form.schedule")}
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isSaving}
          >
            <CheckCircle className="h-4 w-4" />
            {t("admin.form.publish")}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Form */}
      <Form {...form}>
        <VerseForm />
      </Form>

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-background p-4 md:hidden z-40">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("admin.form.saveDraft")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSchedule}
            disabled={isSaving}
            className="flex-1"
          >
            <Calendar className="h-4 w-4" />
            {t("admin.form.schedule")}
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isSaving}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4" />
            {t("admin.form.publish")}
          </Button>
        </div>
      </div>
      </main>
    </div>
  );
}
