import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarClock, Image, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { RichTextEditor } from "../../components/RichTextEditor";
import {
  useBlogPost,
  useCreateBlogPost,
  usePublishBlogPost,
  useScheduleBlogPost,
  useUpdateBlogPost,
  useUploadBlogBodyImage,
  useUploadBlogCover,
} from "../../hooks";

export function BlogPostFormPage() {
  const { t } = useTranslation("blog");
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(postId);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState("");
  /** The state of the autosave of the editor (BR-93). */
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtySince = useRef(false);

  const query = useBlogPost(postId ?? "", { enabled: isEditing });

  useEffect(() => {
    const post = query.data;
    if (!post) return;
    setTitle(post.title);
    setExcerpt(post.excerpt ?? "");
    setBody(post.body);
    setTags(post.tags.map((tag) => tag.name).join("، "));
    setCover(post.cover_image);
    setPublishedAt(post.published_at ?? "");
  }, [query.data]);

  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  const publishPost = usePublishBlogPost();
  const schedulePost = useScheduleBlogPost();
  const uploadCover = useUploadBlogCover();
  const uploadBodyImage = useUploadBlogBodyImage();
  const isSaving =
    createPost.isPending ||
    updatePost.isPending ||
    publishPost.isPending ||
    schedulePost.isPending ||
    uploadCover.isPending;

  const tagNames = useMemo(
    () =>
      tags
        .split(/[،,]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    [tags],
  );

  const payload = {
    title: title.trim(),
    excerpt: excerpt.trim() || null,
    body,
    cover_image: cover,
    tags: tagNames,
    published_at: null,
  };

  /**
   * The autosave of the editor (BR-93).
   *
   * The post is a draft on the server; the form saves it after the
   * writer stops typing, so a crash or a closed tab never costs the
   * work. The autosave never publishes and never schedules: it saves
   * the draft as it is.
   */
  const autosave = useCallback(() => {
    if (!dirtySince.current) return;
    if (!title.trim() || !body.trim()) return;
    setAutosaveState("saving");
    const done = () => {
      dirtySince.current = false;
      setAutosaveState("saved");
    };
    const failed = () => setAutosaveState("error");

    if (postId) {
      updatePost
        .mutateAsync({ postId, data: payload })
        .then(done)
        .catch(failed);
      return;
    }

    // The post does not exist yet: the autosave **creates** the draft
    // and the form continues on the draft it has just written, so the
    // next pause updates it instead of creating a second post.
    createPost
      .mutateAsync(payload)
      .then((created) => {
        done();
        navigate(`/blog/${created.id}/edit`, { replace: true });
      })
      .catch(failed);
    // `payload` is read when the timer fires: the closure is refreshed
    // on every render, so the latest values are the ones that are sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, title, body, excerpt, cover, tags, updatePost, createPost]);

  const scheduleAutosave = useCallback(() => {
    dirtySince.current = true;
    setAutosaveState("idle");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => autosave(), 10_000);
  }, [autosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const handleUploadImage = async (file: File): Promise<string> => {
    const result = await uploadBodyImage.mutateAsync(file);
    return result.url;
  };

  const validate = () => {
    if (payload.title && payload.body) return true;
    toast.error(t("admin.form.required"));
    return false;
  };

  const handleSave = () => {
    if (!validate()) return;

    const onSuccess = () => {
      toast.success(t("admin.actions.save"));
      navigate("/blog");
    };
    const onError = () => toast.error(t("admin.failed"));

    if (isEditing && postId) {
      updatePost.mutate({ postId, data: payload }, { onSuccess, onError });
      return;
    }
    createPost.mutate(payload, { onSuccess, onError });
  };

  const handlePublish = async () => {
    if (!validate()) return;

    try {
      let targetPostId = postId;
      if (targetPostId) {
        await updatePost.mutateAsync({ postId: targetPostId, data: payload });
      } else {
        const created = await createPost.mutateAsync(payload);
        targetPostId = created.id;
      }
      if (!targetPostId) return;
      await publishPost.mutateAsync(targetPostId);
      toast.success(t("admin.published"));
      navigate("/blog");
    } catch {
      toast.error(t("admin.failed"));
    }
  };

  const handleSchedule = async () => {
    if (!publishedAt) {
      toast.error(t("admin.form.scheduleHint"));
      return;
    }

    try {
      let targetPostId = postId;
      if (targetPostId) {
        await updatePost.mutateAsync({ postId: targetPostId, data: payload });
      } else {
        const created = await createPost.mutateAsync(payload);
        targetPostId = created.id;
      }
      if (!targetPostId) return;
      await schedulePost.mutateAsync({
        postId: targetPostId,
        data: { published_at: new Date(publishedAt).toISOString() },
      });
      toast.success(t("admin.scheduled"));
      navigate("/blog");
    } catch {
      toast.error(t("admin.failed"));
    }
  };

  const handleCover = (file: File | undefined) => {
    if (!file) return;
    uploadCover.mutate(file, {
      onSuccess: (result) => setCover(result.url),
      onError: () => toast.error(t("admin.failed")),
    });
  };

  if (isEditing && query.isError) {
    return (
      <div className="space-y-6 p-6">
        <AdminTopbar title={t("admin.form.editTitle")} backHref="/blog" />
        <ErrorRetry onRetry={() => void query.refetch()} />
      </div>
    );
  }

  if (isEditing && query.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <AdminTopbar title={t("admin.form.editTitle")} backHref="/blog" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AdminTopbar
        title={isEditing ? t("admin.form.editTitle") : t("admin.form.newTitle")}
        subtitle={t("admin.form.subtitle")}
        backHref="/blog"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="blog-title">{t("admin.form.titleLabel")}</Label>
            <Input
              id="blog-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                scheduleAutosave();
              }}
              placeholder={t("admin.form.titlePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-excerpt">{t("admin.form.excerptLabel")}</Label>
            <Textarea
              id="blog-excerpt"
              value={excerpt}
              onChange={(event) => {
                setExcerpt(event.target.value);
                scheduleAutosave();
              }}
              placeholder={t("admin.form.excerptPlaceholder")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("admin.form.bodyLabel")}</Label>
            <RichTextEditor
              value={body}
              onChange={(html) => {
                setBody(html);
                scheduleAutosave();
              }}
              onUploadImage={handleUploadImage}
              placeholder={t("editor.placeholder")}
              aria-label={t("admin.form.bodyLabel")}
            />
            <p
              className="text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {autosaveState === "saving"
                ? t("admin.form.autosaveSaving")
                : autosaveState === "saved"
                  ? t("admin.form.autosaveSaved")
                  : autosaveState === "error"
                    ? t("admin.form.autosaveFailed")
                    : ""}
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card-elevated space-y-2 rounded-2xl p-4">
            <Label htmlFor="blog-tags">{t("admin.form.tagsLabel")}</Label>
            <Input
              id="blog-tags"
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
                scheduleAutosave();
              }}
              placeholder={t("admin.form.tagsPlaceholder")}
            />
          </div>

          <div className="card-elevated space-y-2 rounded-2xl p-4">
            <Label>{t("admin.form.coverLabel")}</Label>
            {cover ? (
              <img
                src={cover}
                alt={t("admin.form.coverLabel")}
                className="h-32 w-full rounded-xl border object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/50">
                <Image
                  className="h-8 w-8 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("admin.form.coverHint")}
            </p>
            <div className="flex gap-2">
              <label className="btn-outline inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <Image className="h-4 w-4" aria-hidden="true" />
                {t("admin.form.chooseCover")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleCover(event.target.files?.[0])}
                />
              </label>
              {cover && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCover(null)}
                >
                  {t("admin.form.removeCover")}
                </Button>
              )}
            </div>
          </div>

          <div className="card-elevated space-y-2 rounded-2xl p-4">
            <Label htmlFor="blog-published-at">
              {t("admin.form.scheduleLabel")}
            </Label>
            <Input
              id="blog-published-at"
              type="datetime-local"
              value={publishedAt}
              onChange={(event) => setPublishedAt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.form.scheduleHint")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="btn-primary"
              disabled={isSaving}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {t("admin.actions.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => void handlePublish()}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("admin.actions.saveAndPublish")}
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || !publishedAt}
                onClick={handleSchedule}
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                {t("admin.actions.schedule")}
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/blog">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                {t("admin.form.backToList")}
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default BlogPostFormPage;
