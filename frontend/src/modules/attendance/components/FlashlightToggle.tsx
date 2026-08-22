import { useState } from "react";
import { Flashlight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Switch } from "@/components/ui/switch";

interface FlashlightToggleProps {
  scannerRef: RefObject<Html5Qrcode | null>;
}

/**
 * Capability-gated torch pill: the parent renders it only after
 * `getRunningTrackCapabilities()` reports a `torch` entry, so devices
 * without torch support never see a dead control.
 */
export function FlashlightToggle({ scannerRef }: FlashlightToggleProps) {
  const { t } = useTranslation("attendance");
  const [on, setOn] = useState(false);

  const applyTorch = async (enabled: boolean) => {
    setOn(enabled);
    try {
      await scannerRef.current?.applyVideoConstraints({
        advanced: [{ torch: enabled }],
      } as unknown as MediaTrackConstraints);
    } catch {
      /* device refused; leave state as toggled */
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-full bg-navy/80 px-4 py-2 text-white shadow-lg backdrop-blur-sm">
      <Flashlight className="h-4 w-4" aria-hidden="true" />
      <label htmlFor="torch-toggle" className="text-sm font-medium">
        {t("checkIn.scanner.flashlight")}
      </label>
      <Switch
        id="torch-toggle"
        checked={on}
        onCheckedChange={(checked) => void applyTorch(checked)}
        aria-label={t("checkIn.scanner.flashlight")}
      />
    </div>
  );
}
