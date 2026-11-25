import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Palette,
  Redo2,
  Smile,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useApiError } from "@/hooks/useApiError";
import { isImageTooLarge } from "@/lib/imageUpload";

interface RichTextEditorProps {
  /** The sanitized HTML held by the server. */
  value: string;
  /** Called with the HTML whenever the writer changes the text. */
  onChange: (html: string) => void;
  /**
   * Upload a picture of the body and return its address.
   *
   * The editor does not upload by itself: the page owns the client and
   * the media service, and the editor only inserts the address it gets
   * back. When the callback is missing, the button of the picture is
   * not shown.
   */
  onUploadImage?: (file: File) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

interface ToolbarButtonProps {
  editor: Editor;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({
  editor,
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="focus-ring h-9 w-9"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled || !editor.isEditable}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * The one rich-text editor of the blog.
 *
 * Posts and comments share this component, so the toolbar and the HTML
 * contract live in one place. TipTap writes HTML; the server sanitises
 * that HTML before it becomes the answer that a member reads.
 */
export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  disabled = false,
  placeholder,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: RichTextEditorProps) {
  const { t } = useTranslation("blog");
  const { t: tErrors } = useTranslation("errors");
  const describeError = useApiError();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["right", "center", "left", "justify"],
      }),
      Placeholder.configure({
        placeholder: placeholder ?? t("editor.placeholder"),
      }),
      Image.configure({
        // The picture of the body is uploaded by the media service of
        // the platform; the editor only holds its address.
        allowBase64: false,
        inline: false,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => {
      onChangeRef.current(updatedEditor.getHTML());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  /** Upload the picture the writer chose and insert it in the body. */
  const insertImage = async (file: File) => {
    const upload = uploadRef.current;
    if (!upload || !editor) return;
    setUploadError(null);
    if (isImageTooLarge(file)) {
      setUploadError(tErrors("api.imageTooLarge" as never));
      return;
    }
    setUploading(true);
    try {
      const url = await upload(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (error) {
      setUploadError(describeError(error).message);
    } finally {
      setUploading(false);
    }
  };

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-48 rounded-xl border border-border bg-card",
          className,
        )}
        aria-busy="true"
      />
    );
  }

  const emojiKeys = [
    "smile",
    "joy",
    "heart",
    "pray",
    "star",
    "fire",
    "coffee",
    "check",
  ] as const;
  const colorKeys = ["navy", "blue", "mint", "orange", "red"] as const;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-70",
        className,
      )}
      role="group"
      aria-label={ariaLabel ?? t("editor.label")}
      aria-invalid={ariaInvalid}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-soft p-2">
        <ToolbarButton
          editor={editor}
          label={t("editor.bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t("editor.italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t("editor.underline")}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t("editor.bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t("editor.orderedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        {onUploadImage ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void insertImage(file);
              }}
            />
            <ToolbarButton
              editor={editor}
              label={uploading ? t("editor.imageUploading") : t("editor.image")}
              disabled={disabled || !editor.isEditable || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
          </>
        ) : null}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="focus-ring h-9 w-9"
              aria-label={t("editor.color")}
              title={t("editor.color")}
              disabled={disabled || !editor.isEditable}
            >
              <Palette className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="flex items-center gap-2" dir="ltr">
              {colorKeys.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "focus-ring h-7 w-7 rounded-full border border-border",
                    color === "navy" && "bg-navy",
                    color === "blue" && "bg-brand-blue",
                    color === "mint" && "bg-mint",
                    color === "orange" && "bg-brand-orange",
                    color === "red" && "bg-brand-red",
                  )}
                  aria-label={t(`editor.colors.${color}`)}
                  title={t(`editor.colors.${color}`)}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .setColor(`var(--brand-${color})`)
                      .run()
                  }
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                {t("editor.removeColor")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="focus-ring h-9 w-9"
              aria-label={t("editor.emoji")}
              title={t("editor.emoji")}
              disabled={disabled || !editor.isEditable}
            >
              <Smile className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="grid grid-cols-4 gap-1" dir="ltr">
              {emojiKeys.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="focus-ring grid h-9 w-9 place-items-center rounded-md text-xl hover:bg-secondary"
                  aria-label={t(`editor.emojiLabels.${emoji}`)}
                  title={t(`editor.emojiLabels.${emoji}`)}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .insertContent(t(`editor.emojis.${emoji}`))
                      .run()
                  }
                >
                  {t(`editor.emojis.${emoji}`)}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolbarButton
          editor={editor}
          label={t("editor.undo")}
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t("editor.redo")}
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      </div>

      {uploadError ? (
        <p className="border-t border-border bg-soft px-4 py-2 text-xs text-brand-red">
          {uploadError}
        </p>
      ) : null}

      <EditorContent
        editor={editor}
        className="prose-editor min-h-48 px-4 py-3 font-arabic text-ink focus:outline-none [&_h1]:font-heading [&_h2]:font-heading [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:my-1 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
      />
    </div>
  );
}
