import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CoverImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CoverImageField({
  value,
  onChange,
  disabled,
}: CoverImageFieldProps) {
  const { t } = useTranslation("bible");
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const text = e.dataTransfer.getData("text/plain");
      if (text && text.startsWith("http")) {
        onChange(text);
      }
    },
    [onChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Cover preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 end-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            {t("admin.form.dragDrop")}{" "}
            <Upload className="inline h-4 w-4 mx-1" />
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("admin.form.dragDropHint")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder={t("admin.form.fields.imageUrl")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
