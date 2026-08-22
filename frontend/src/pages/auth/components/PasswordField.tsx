import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
  autoComplete?: string;
  lang: "ar" | "en";
  showPasswordLabel: string;
  hidePasswordLabel: string;
}

export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  invalid = false,
  autoComplete = "new-password",
  lang,
  showPasswordLabel,
  hidePasswordLabel,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock
        className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        className={cn(
          "h-11 w-full rounded-xl border-border bg-background ps-9 pe-10 text-base focus-ring",
          lang === "ar" && "font-arabic text-lg placeholder:text-base",
          invalid && "border-brand-red focus-visible:ring-brand-red",
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hidePasswordLabel : showPasswordLabel}
        className="absolute inset-y-0 end-2 my-auto grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-ink focus-ring"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
