import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SelectFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  invalid?: boolean;
}

export function SelectField({
  id,
  value,
  onChange,
  placeholder,
  options,
  invalid = false,
}: SelectFieldProps) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className={cn(invalid && "border-brand-red focus:ring-brand-red")}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
