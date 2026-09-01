import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { attendancePinApi } from "@/modules/attendance/api";
import { PinEntry } from "@/modules/attendance/components/PinEntry";

type PinStatus = { kind: "ok" | "error"; text: string } | null;

/**
 * The member's self-chosen attendance PIN: set once, change or delete at
 * will (no password prompt). The PIN itself never travels back from the
 * server — only whether one exists.
 */
export function AttendancePinCard() {
  const { t } = useTranslation("profile");

  const [loaded, setLoaded] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<PinStatus>(null);
  /** Bumped so the entry boxes clear between attempts */
  const [entryNonce, setEntryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    attendancePinApi
      .getStatus()
      .then((data) => {
        if (!cancelled) {
          setPinSet(data.set);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          setStatus({ kind: "error", text: t("pin.loadFailed") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSave = async (pin: string) => {
    setSaving(true);
    setStatus(null);
    try {
      await attendancePinApi.set(pin);
      setPinSet(true);
      setEditing(false);
      setStatus({ kind: "ok", text: t("pin.saved") });
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === "conflict" || error.status === 409)
      ) {
        setStatus({ kind: "error", text: t("pin.taken") });
      } else {
        setStatus({ kind: "error", text: t("pin.saveFailed") });
      }
      setEditing(true);
    } finally {
      setSaving(false);
      setEntryNonce((nonce) => nonce + 1);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await attendancePinApi.remove();
      setPinSet(false);
      setEditing(false);
      setStatus({ kind: "ok", text: t("pin.deleted") });
    } catch {
      setStatus({ kind: "error", text: t("pin.deleteFailed") });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 card-elevated">
      <h2
        className="flex items-center gap-2 font-extrabold text-ink font-arabic text-xl"
      >
        <KeyRound className="h-5 w-5 text-mint" aria-hidden="true" />
        {t("pin.title")}
        {loaded && pinSet ? (
          <span
            className="ms-auto rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-ink font-arabic"
          >
            {t("pin.setLabel")}
          </span>
        ) : null}
      </h2>

      <p
        className="mt-2 text-sm text-muted-foreground font-arabic text-base"
      >
        {t("pin.description")}
      </p>

      {!loaded ? null : !pinSet || editing ? (
        <div className="mt-4 space-y-3">
          <PinEntry
            key={entryNonce}
            isPending={saving}
            onSubmit={(pin) => void handleSave(pin)}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setStatus(null);
                  setEntryNonce((nonce) => nonce + 1);
                }}
                className="font-arabic"
              >
                {t("pin.cancel")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span
            dir="ltr"
            className="font-heading text-2xl tracking-[0.5em] text-muted-foreground select-none"
          >
            •••••
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(true);
              setStatus(null);
            }}
            className="rounded-xl font-arabic"
          >
            {t("pin.change")}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={deleting}
                className="rounded-xl text-brand-red hover:text-brand-red font-arabic"
              >
                {t("pin.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-arabic">
                  {t("pin.deleteTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription
                className="font-arabic"
                >
                  {t("pin.deleteBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
            className="rounded-xl font-arabic"
                >
                  {t("pin.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDelete()}
                  className="rounded-xl bg-brand-red text-white hover:bg-brand-red/90 font-arabic"
                >
                  {t("pin.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {status ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-center text-sm font-medium font-arabic",
            status.kind === "ok" ? "text-ink" : "text-brand-red",
          )}
        >
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
