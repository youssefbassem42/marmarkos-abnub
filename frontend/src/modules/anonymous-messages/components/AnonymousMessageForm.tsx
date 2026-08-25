import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, Pencil, Send, ShieldCheck, User } from "lucide-react";
import {
  anonymousMessageSchema,
  MESSAGE_MAX_LENGTH,
  type AnonymousMessageFormValues,
} from "./anonymousMessageSchema";
import { AnonymityNotice } from "./AnonymityNotice";
import { useSubmitAnonymousMessage } from "../hooks";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AnonymousMessageCreateResponse } from "../types";

interface AnonymousMessageFormProps {
  onSubmitted: (response: AnonymousMessageCreateResponse) => void;
}

/**
 * The submission card from the design (US-019): mint mail badge, the
 * <100% secure> line, optional self-declared name/phone with in-field
 * Lucide icons placed with logical padding (they flip with direction),
 * and a live counter that turns red past the limit (BR-16). The
 * textarea has no hard maxLength so senders can SEE they exceeded it.
 */
export function AnonymousMessageForm({
  onSubmitted,
}: AnonymousMessageFormProps) {
  const { t } = useTranslation("anonymousMessages");
  const [submitted, setSubmitted] =
    useState<AnonymousMessageCreateResponse | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnonymousMessageFormValues>({
    resolver: zodResolver(
      anonymousMessageSchema({
        messageRequired: t("validation.messageRequired"),
        messageMin: t("validation.messageMin", { min: 10 }),
        messageMax: t("validation.messageMax", { max: MESSAGE_MAX_LENGTH }),
        nameMax: t("validation.nameMax"),
        phoneInvalid: t("validation.phoneInvalid"),
      }),
    ),
    defaultValues: { message: "", sender_name: "", sender_phone: "" },
  });

  const submission = useSubmitAnonymousMessage();
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const messageValue = watch("message") ?? "";
  // The design draws the counter as plain digits ("0 / 1000"); i18next
  // owns the layout, we own nothing but the numbers.
  const counter = t("form.counter", {
    count: messageValue.length,
    max: MESSAGE_MAX_LENGTH,
  });
  const overLimit = messageValue.length > MESSAGE_MAX_LENGTH;

  const onSubmit = handleSubmit(async (values) => {
    setSubmissionError(null);
    let response: AnonymousMessageCreateResponse;
    try {
      response = await submission.mutateAsync({
        message: values.message.trim(),
        sender_name: values.sender_name?.trim() || null,
        sender_phone: values.sender_phone?.trim() || null,
      });
    } catch (error) {
      // BR-15: a rate-limited submission is the one failure the sender
      // must see — nothing was stored.
      if (error instanceof ApiError && error.status === 429) {
        setSubmissionError(t("validation.rateLimited"));
        return;
      }
      throw error;
    }
    // BR-13: success state for delivered AND status FAILED alike —
    // the sender must never see a delivery failure.
    setSubmitted(response);
    reset();
  });

  if (submitted) {
    return (
      <section className="card-elevated rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint/15">
          <ShieldCheck className="size-8 text-mint" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-heading text-xl font-bold text-ink">
          {t("success.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("success.body")}
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(null)}
          className="btn-outline mt-6 px-5 py-2.5 text-sm"
        >
          {t("success.sendAnother")}
        </button>
      </section>
    );
  }

  return (
    <section className="card-elevated rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint/15">
          <Mail className="size-6 text-mint" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">
            {t("card.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("card.subtitle")}
          </p>
        </div>
      </div>

      <AnonymityNotice />

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 grid gap-5"
        noValidate
      >
        <div className="grid gap-1.5">
          <label htmlFor="anon-name" className="text-sm font-medium text-ink">
            {t("form.name")}
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="anon-name"
              type="text"
              maxLength={120}
              placeholder={t("form.namePlaceholder")}
              className="focus-ring h-11 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-sm text-ink placeholder:text-muted-foreground"
              {...register("sender_name")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("form.nameHint")}</p>
          {errors.sender_name && (
            <p className="text-xs text-brand-red">
              {errors.sender_name.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="anon-phone" className="text-sm font-medium text-ink">
            {t("form.phone")}
          </label>
          <div className="relative">
            <Pencil
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="anon-phone"
              type="tel"
              maxLength={32}
              dir="ltr"
              placeholder={t("form.phonePlaceholder")}
              className="focus-ring h-11 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-sm text-ink placeholder:text-muted-foreground"
              {...register("sender_phone")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("form.phoneHint")}</p>
          {errors.sender_phone && (
            <p className="text-xs text-brand-red">
              {errors.sender_phone.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="anon-message"
              className="text-sm font-medium text-ink"
            >
              {t("form.message")}
            </label>
            <span
              className={cn(
                "text-xs tabular-nums",
                overLimit
                  ? "font-bold text-brand-red"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {counter}
            </span>
          </div>
          <textarea
            id="anon-message"
            rows={5}
            placeholder={t("form.messagePlaceholder")}
            className={cn(
              "focus-ring w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed text-ink placeholder:text-muted-foreground",
              overLimit && "border-brand-red",
            )}
            {...register("message")}
          />
          {(errors.message || overLimit) && (
            <p className="text-xs text-brand-red" role="alert">
              {errors.message?.message ?? ""}
            </p>
          )}
        </div>

        {submissionError && (
          <p className="text-sm text-brand-red" role="alert">
            {submissionError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || submission.isPending || overLimit}
          className="btn-primary w-full px-6 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4 rtl:rotate-180" aria-hidden="true" />
          {isSubmitting || submission.isPending
            ? t("form.submitting")
            : t("form.submit")}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          {t("form.footnote")}
        </p>
      </form>
    </section>
  );
}
