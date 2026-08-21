import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ms-1 text-brand-red" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-sm font-medium text-brand-red"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
