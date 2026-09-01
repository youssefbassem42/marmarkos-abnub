import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { X } from "lucide-react";

interface OptionRowProps {
  letter: string;
  option: { optionText: string; isCorrect: boolean };
  index: number;
  canDelete: boolean;
  textValue: string;
  onTextChange: (value: string) => void;
  onCorrectChange: () => void;
  onDelete: () => void;
}

export function OptionRow({
  letter,
  option,
  index,
  canDelete,
  textValue,
  onTextChange,
  onCorrectChange,
  onDelete,
}: OptionRowProps) {
  const { t } = useTranslation("quiz");

  return (
    <div className="flex items-center gap-3">
      <Badge
        variant="outline"
        className="h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold"
      >
        {letter}
      </Badge>

      <Input
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`${t("admin.question.options")} ${letter}`}
        className="flex-1"
      />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RadioGroupItem
            value={String(index)}
            onSelect={onCorrectChange}
          />
          {t("admin.question.correct")}
        </label>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label={t("admin.question.removeOption")}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
