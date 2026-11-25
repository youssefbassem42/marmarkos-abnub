import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/auth";
import { uploadVerseCover } from "@/lib/api";
import { useApiError } from "@/hooks/useApiError";
import { isImageTooLarge } from "@/lib/imageUpload";

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
  const { t: tErrors } = useTranslation();
  const describeError = useApiError();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (file: File) => {
      if (isImageTooLarge(file)) {
        toast.error(tErrors("errors.api.imageTooLarge" as never));
        return;
      }
      const token = getAccessToken();
      if (!token) return;
      setUploading(true);
      try {
        const { url } = await uploadVerseCover(file, token);
        onChange(url);
      } catch (error) {
        toast.error(describeError(error).message);
      } finally {
        setUploading(false);
      }
    },
    [describeError, onChange, tErrors],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) doUpload(file);
    },
    [doUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) doUpload(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [doUpload],
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
            alt={t("admin.form.fields.image")}
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 end-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center w-full h-40 rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-10 w-10 text-muted-foreground/50 mb-2 animate-spin" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
          )}
          <p className="text-sm text-muted-foreground text-center">
            {uploading
              ? t("admin.form.fields.uploading")
              : t("admin.form.fields.dragDrop")}{" "}
            {!uploading && <Upload className="inline h-4 w-4 mx-1" />}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("admin.form.fields.dragDropHint")}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {!value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="me-2 h-4 w-4" />
          )}
          {uploading
            ? t("admin.form.fields.uploading")
            : t("admin.form.fields.dragDrop")}
        </Button>
      )}
    </div>
  );
}
