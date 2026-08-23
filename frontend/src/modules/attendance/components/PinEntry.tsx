import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 5;

interface PinEntryProps {
  /** Blocks editing and shows a spinner while the check-in round-trips */
  isPending?: boolean;
  disabled?: boolean;
  onSubmit: (pin: string) => void;
  className?: string;
}

/**
 * Five single-digit boxes with auto-advance, backspace-to-previous and
 * full-string paste. Submitting fires automatically once the fifth
 * digit lands — the servant workflow is type-type-type-done.
 */
export function PinEntry({
  isPending = false,
  disabled = false,
  onSubmit,
  className,
}: PinEntryProps) {
  const { t } = useTranslation("attendance");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const focusIndex = (index: number) => {
    inputsRef.current[Math.max(0, Math.min(PIN_LENGTH - 1, index))]?.focus();
  };

  const commitIfComplete = (digits: string[]) => {
    if (digits.every((digit) => digit !== "") && !isPending && !disabled) {
      onSubmit(digits.join(""));
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const digits = event.target.value.replace(/\D/g, "").slice(-1);
    if (!digits) return;
    event.target.value = digits;
    if (index < PIN_LENGTH - 1) {
      focusIndex(index + 1);
    } else {
      commitIfComplete(
        inputsRef.current.map((input, i) =>
          i === index ? digits : (input?.value ?? ""),
        ),
      );
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      const previous = inputsRef.current[index - 1];
      if (previous) {
        previous.value = "";
        previous.focus();
      }
      event.preventDefault();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    for (let i = 0; i < PIN_LENGTH; i += 1) {
      const input = inputsRef.current[i];
      if (input) input.value = pasted[i] ?? "";
    }
    focusIndex(Math.min(pasted.length, PIN_LENGTH - 1));
    commitIfComplete(inputsRef.current.map((input) => input?.value ?? ""));
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          dir="ltr"
          disabled={disabled || isPending}
          aria-label={t("checkIn.pin.digitLabel", { position: index + 1 })}
          onChange={(event) => handleChange(event, index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className="h-14 w-12 rounded-xl border border-border bg-background text-center font-heading text-xl font-bold text-ink shadow-sm transition-colors focus:border-navy focus:outline-none focus:ring-2 focus:ring-mint/40 disabled:opacity-50"
        />
      ))}
      {isPending ? (
        <Loader2
          className="ms-1 h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
