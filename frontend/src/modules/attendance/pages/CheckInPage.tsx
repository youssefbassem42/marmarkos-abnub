import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { QRScanner, type CameraFailure } from "../components/QRScanner";
import { ManualCodeEntry } from "../components/ManualCodeEntry";
import { ScanTips } from "../components/ScanTips";
import { ScanResultCard } from "../components/ScanResultCard";
import { MeetingStatsCard } from "../components/MeetingStatsCard";
import { RecentCheckInsCard } from "../components/RecentCheckInsCard";
import { useCheckIn } from "../hooks/useCheckIn";
import type { AttendanceRecord } from "../types";

/**
 * One discriminated union for every scanner/result state — no boolean
 * soup. Success auto-resumes after 3 s, errors after 5 s; timers are
 * always cleared on unmount and on a new scan.
 */
type ScanState =
  | { kind: "idle" }
  | { kind: "requesting-permission" }
  | { kind: "permission-denied"; message?: string }
  | { kind: "unsupported" }
  | { kind: "scanning" }
  | { kind: "processing"; code: string }
  | { kind: "success"; record: AttendanceRecord }
  | { kind: "duplicate"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "forbidden"; message: string }
  | { kind: "network"; message: string };

const SUCCESS_RESUME_MS = 3000;
const ERROR_RESUME_MS = 5000;

function errorKey(error: ApiError): keyof typeof ERROR_KEYS | undefined {
  if (error.code === "conflict" || error.status === 409) return "conflict";
  if (error.code === "validation_error" || error.status === 422)
    return "validation";
  if (error.code === "forbidden" || error.status === 403) return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 0 || error.status >= 500) return "network";
  return undefined;
}

const ERROR_KEYS = {
  unauthorized: true,
  forbidden: true,
  conflict: true,
  validation: true,
  network: true,
  unknown: true,
} as const;

export function CheckInPage() {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [torchAvailable, setTorchAvailable] = useState(false);

  const checkIn = useCheckIn();
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current !== null) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  // Every timer is cleared on unmount (TASK-308 #3).
  useEffect(() => clearResumeTimer, [clearResumeTimer]);

  const scheduleResume = useCallback(
    (delay: number) => {
      clearResumeTimer();
      resumeTimer.current = setTimeout(() => {
        resumeTimer.current = null;
        setState({ kind: "scanning" });
      }, delay);
    },
    [clearResumeTimer],
  );

  const submitCode = useCallback(
    (qrCode: string) => {
      clearResumeTimer();
      setState({ kind: "processing", code: qrCode });
      checkIn.mutate(
        { qr_code: qrCode },
        {
          onSuccess: (response) => {
            setState({ kind: "success", record: response.attendance });
            scheduleResume(SUCCESS_RESUME_MS);
          },
          onError: (error) => {
            if (!(error instanceof ApiError)) {
              setState({ kind: "network", message: t("errors.network") });
              scheduleResume(ERROR_RESUME_MS);
              return;
            }
            const key = errorKey(error);
            const message =
              (key ? t(`errors.${key}`) : undefined) ??
              error.message ??
              t("errors.unknown");

            if (key === "conflict") setState({ kind: "duplicate", message });
            else if (key === "validation")
              setState({ kind: "invalid", message });
            else if (key === "forbidden")
              setState({ kind: "forbidden", message });
            else if (key === "unauthorized")
              setState({ kind: "network", message });
            else setState({ kind: "network", message });

            if (key !== "forbidden") scheduleResume(ERROR_RESUME_MS);
          },
        },
      );
    },
    [checkIn, clearResumeTimer, scheduleResume, t],
  );

  const handleCameraFailure = useCallback((failure: CameraFailure) => {
    if (failure === "permission-denied")
      setState({ kind: "permission-denied" });
    else if (failure === "unsupported") setState({ kind: "unsupported" });
    else setState({ kind: "network", message: "" });
    manualEntryRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  // Keyboard: Enter restarts scanning from a result; M focuses manual entry.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isResult =
        state.kind === "success" ||
        state.kind === "duplicate" ||
        state.kind === "invalid" ||
        state.kind === "forbidden" ||
        state.kind === "network";
      if (event.key === "Enter" && isResult) {
        event.preventDefault();
        setState({ kind: "scanning" });
      }
      if (
        (event.key === "m" || event.key === "M") &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        manualEntryRef.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.kind]);

  const cameraActive = state.kind === "scanning" || state.kind === "processing";

  const heading = (() => {
    switch (state.kind) {
      case "permission-denied":
        return t("checkIn.scanner.permissionTitle");
      case "unsupported":
        return t("checkIn.scanner.unsupportedTitle");
      case "scanning":
      case "processing":
        return t("checkIn.scanner.scanningTitle");
      case "success":
        return t("checkIn.result.successTitle");
      case "duplicate":
        return t("checkIn.result.duplicateTitle");
      case "invalid":
        return t("checkIn.result.invalidTitle");
      case "forbidden":
        return t("checkIn.result.forbiddenTitle");
      case "network":
        return t("checkIn.result.networkTitle");
      default:
        return t("checkIn.scanner.readyTitle");
    }
  })();

  const subheading = (() => {
    switch (state.kind) {
      case "scanning":
        return t("checkIn.scanner.scanningSubtitle");
      case "processing":
        return t("checkIn.scanner.processingSubtitle");
      default:
        return t("checkIn.scanner.readySubtitle");
    }
  })();

  const showCamera =
    state.kind !== "permission-denied" && state.kind !== "unsupported";

  const manualExpanded =
    state.kind === "permission-denied" || state.kind === "unsupported";

  const resultState =
    state.kind === "success" ||
    state.kind === "duplicate" ||
    state.kind === "invalid" ||
    state.kind === "forbidden" ||
    state.kind === "network"
      ? state
      : null;

  const resultVariant =
    resultState?.kind === "success"
      ? "success"
      : resultState?.kind === "duplicate"
        ? "warning"
        : ("error" as const);

  return (
    <div dir={isArabic ? "rtl" : "ltr"} lang={language} className="space-y-6">
      {/* Scanner card */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)]">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
            <QrCode className="h-8 w-8 text-mint" aria-hidden="true" />
          </span>
          <h2
            aria-live="polite"
            className={cn(
              "mt-4 font-heading text-2xl font-bold text-ink",
              isArabic && "font-arabic",
            )}
          >
            {heading}
          </h2>
          <p
            className={cn(
              "mt-1 text-sm text-muted-foreground",
              isArabic && "font-arabic text-base",
            )}
          >
            {subheading}
          </p>
        </div>

        <div className="mt-5">
          {showCamera ? (
            <QRScanner
              onScan={submitCode}
              isProcessing={state.kind === "processing"}
              paused={
                state.kind === "success" ||
                state.kind === "duplicate" ||
                state.kind === "invalid" ||
                state.kind === "forbidden" ||
                state.kind === "network"
              }
              onFailure={handleCameraFailure}
              onTorchAvailable={() => setTorchAvailable(true)}
            />
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl bg-muted">
              <p className="max-w-xs px-4 text-sm text-muted-foreground">
                {state.kind === "permission-denied"
                  ? t("checkIn.scanner.permissionBody")
                  : t("checkIn.scanner.unsupportedBody")}
              </p>
            </div>
          )}
        </div>

        {/* torch pill renders inside QRScanner only when capable */}

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isArabic ? "أو" : "OR"}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div ref={manualEntryRef}>
          <ManualCodeEntry
            expanded={manualExpanded}
            isPending={state.kind === "processing"}
            onSubmit={(code) => submitCode(code)}
          />
        </div>

        <div className="mt-4">
          <ScanTips />
        </div>
      </section>

      {/* Result card */}
      <div aria-live="polite">
        {resultState &&
          (resultState.kind === "success" ? (
            <ScanResultCard
              variant="success"
              title={t("checkIn.result.successTitle")}
              record={resultState.record}
              onScanNext={() => {
                clearResumeTimer();
                setState({ kind: "scanning" });
              }}
            />
          ) : (
            <ScanResultCard
              variant={resultVariant}
              title={heading}
              onScanNext={
                resultState.kind === "forbidden"
                  ? undefined
                  : () => {
                      clearResumeTimer();
                      setState({ kind: "scanning" });
                    }
              }
            />
          ))}
      </div>

      {/* Bottom cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MeetingStatsCard />
        <RecentCheckInsCard />
      </div>

      {/* Screen-reader announcement region for scan results */}
      <p role="status" className="sr-only">
        {cameraActive ? t("checkIn.scanner.scanningTitle") : ""}
      </p>

      {/* aria-keyshortcuts documentation lives on the interactive wrappers above */}
      <span className="sr-only" aria-keyshortcuts="Enter M" />
      {/* keep torch flag referenced for a11y tooling */}
      <span data-torch={torchAvailable ? "on" : "off"} className="sr-only" />
    </div>
  );
}
