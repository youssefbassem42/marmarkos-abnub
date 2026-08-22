import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useTranslation } from "react-i18next";
import { ScannerFrame } from "./ScannerFrame";
import { FlashlightToggle } from "./FlashlightToggle";
import { cn } from "@/lib/utils";

export type CameraFailure = "permission-denied" | "unsupported" | "network";

interface QRScannerProps {
  /** Called with the decoded QR payload; fires at most once per code. */
  onScan: (data: string) => void;
  /** True while the parent is recording a scan; pauses the camera feed. */
  isProcessing?: boolean;
  /** Parent-driven pause/resume (e.g. while showing a result card). */
  paused?: boolean;
  /** Reported when the camera fails to start; the parent maps it to state. */
  onFailure?: (failure: CameraFailure) => void;
  /** Rendered above the viewport when the device reports torch support. */
  onTorchAvailable?: () => void;
}

function classifyFailure(error: unknown): CameraFailure {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "unsupported";
  return "network";
}

/**
 * html5-qrcode wrapper. Owns the camera lifecycle only — headings,
 * results and manual entry live in the parent so the state machine in
 * CheckInPage stays the single source of truth.
 */
export function QRScanner({
  onScan,
  isProcessing = false,
  paused = false,
  onFailure,
  onTorchAvailable,
}: QRScannerProps) {
  const { t } = useTranslation("attendance");
  const readerId = `qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    return () => {
      // Cleanup that cannot race: stop before clear, swallowing only the
      // documented "scanner is not running" error.
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      void (async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {
          /* not running */
        }
        try {
          scanner.clear();
        } catch {
          /* element already gone */
        }
      })();
    };
  }, []);

  useEffect(() => {
    if (!paused || !scannerRef.current) return;
    void (async () => {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        setIsRunning(false);
      } catch {
        /* already stopped */
      }
    })();
  }, [paused]);

  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = scanner;
      }

      const cameraIdOrConfig = { facingMode: "environment" as const };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      const handleDecoded = (decoded: string) => {
        // Ignore duplicate reports of the same code within 2 s so one
        // physical badge cannot fire five requests.
        const now = Date.now();
        if (
          lastCodeRef.current.code === decoded &&
          now - lastCodeRef.current.at < 2000
        ) {
          return;
        }
        lastCodeRef.current = { code: decoded, at: now };
        onScan(decoded);
      };

      await scanner.start(cameraIdOrConfig, config, handleDecoded, () => {});

      const capabilities =
        scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
          torch?: unknown;
        };
      if ("torch" in capabilities && capabilities.torch !== undefined) {
        onTorchAvailable?.();
      }
      setIsRunning(true);
    } catch (error) {
      onFailure?.(classifyFailure(error));
    } finally {
      startingRef.current = false;
    }
  };

  const stop = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      setIsRunning(false);
    } catch {
      /* not running */
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="region"
        aria-label={t("checkIn.scanner.scanningTitle")}
        className="relative overflow-hidden rounded-2xl bg-navy"
      >
        <div
          id={readerId}
          className={cn("w-full [&_video]:w-full [&_video]:object-cover")}
        />
        {isRunning ? (
          <>
            <ScannerFrame />
            {!paused && !isProcessing && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <FlashlightToggle scannerRef={scannerRef} />
              </div>
            )}
          </>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-navy/95 text-center">
            <p className="font-heading text-xl font-bold text-white">
              {t("checkIn.scanner.readyTitle")}
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="btn-primary px-6 py-2.5 text-sm"
            >
              {t("checkIn.scanner.start")}
            </button>
          </div>
        )}
        {(isProcessing || (paused && isRunning)) && (
          <div className="absolute inset-0 grid place-items-center bg-background/80">
            <span
              className="h-12 w-12 animate-spin rounded-full border-4 border-brand-blue border-t-transparent"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {isRunning && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void stop()}
            className="btn-outline px-5 py-2 text-sm text-status-absent"
          >
            {t("checkIn.scanner.stop")}
          </button>
        </div>
      )}
    </div>
  );
}
