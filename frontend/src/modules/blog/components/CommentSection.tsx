import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Pencil, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAuthUser } from "@/lib/auth";
import { formatDateOrEmpty } from "@/lib/datetime";

import { CommentLikeButton } from "./CommentLikeButton";
import {
  useBlogComments,
  useCreateBlogComment,
  useDeleteBlogComment,
  useUpdateBlogComment,
} from "../hooks";
import type { BlogComment } from "../types";

interface CommentSectionProps {
  postId: string;
  /**
   * The lifecycle of the post. Only a published post accepts comments:
   * the tree of a draft is not public, so the server refuses it (BR-64).
   */
  status: string;
}

interface CommentItemProps {
  comment: BlogComment;
  postId: string;
  depth: number;
}

/** The editor of a comment: the body of a new comment, a reply or an edit. */
function CommentForm({
  initialValue = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValue?: string;
  submitLabel: string;
  onSubmit: (content: string) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation("blog");
  const [content, setContent] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit(content.trim());
      setContent("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-2" onSubmit={(event) => void handleSubmit(event)}>
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={3}
        placeholder={submitLabel}
        aria-label={submitLabel}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="btn-primary"
          disabled={isSaving}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("comments.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** One comment and the replies nested underneath it. */
function CommentItem({ comment, postId, depth }: CommentItemProps) {
  const { t } = useTranslation("blog");
  const viewer = getAuthUser();
  const isOwner = viewer?.id === comment.author.id;
  const isModerator = viewer?.role === "ADMIN" || viewer?.role === "SERVANT";

  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const likeState = comment as typeof comment & {
    likes_count?: number;
    liked?: boolean;
  };

  const createComment = useCreateBlogComment(postId);
  const updateComment = useUpdateBlogComment(postId);
  const deleteComment = useDeleteBlogComment(postId);

  const date = formatDateOrEmpty(
    comment.created_at,
    { year: "numeric", month: "long", day: "numeric" },
    "ar-EG",
  );

  const handleDelete = async () => {
    await deleteComment.mutateAsync(comment.id);
    toast.success(t("comments.deleted"));
  };

  return (
    <li className="space-y-3 border-s-2 border-border ps-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">
          {comment.author.full_name}
          {date ? (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {date}
            </span>
          ) : null}
        </p>

        {isEditing ? (
          <CommentForm
            initialValue={comment.content}
            submitLabel={t("comments.save")}
            onCancel={() => setIsEditing(false)}
            onSubmit={async (content) => {
              await updateComment.mutateAsync({
                commentId: comment.id,
                data: { content },
              });
              setIsEditing(false);
              toast.success(t("comments.updated"));
            }}
          />
        ) : (
          <div
            className="prose-editor text-sm leading-7 text-ink [&_a]:text-brand-blue [&_li]:my-1 [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />
        )}

        {!isEditing && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CommentLikeButton
              commentId={comment.id}
              likesCount={likeState.likes_count ?? 0}
              liked={likeState.liked ?? false}
            />
            {viewer && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsReplying((open) => !open)}
                >
                  <Reply className="h-4 w-4" aria-hidden="true" />
                  {t("comments.reply")}
                </Button>
                {isOwner && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t("comments.edit")}
                  </Button>
                )}
                {(isOwner || isModerator) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete()}
                    disabled={deleteComment.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t("comments.delete")}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {isReplying && (
          <CommentForm
            submitLabel={t("comments.sendReply")}
            onCancel={() => setIsReplying(false)}
            onSubmit={async (content) => {
              await createComment.mutateAsync({
                content,
                parent_comment_id: comment.id,
              });
              setIsReplying(false);
              toast.success(t("comments.sent"));
            }}
          />
        )}
      </div>

      {comment.replies.length > 0 && (
        <ul className="space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The comments of a published post.
 *
 * The tree comes from the server: the backend sanitises the HTML of every
 * comment before it is stored, so the markup rendered here is the
 * server's contract and never a member's raw value.
 */
export function CommentSection({ postId, status }: CommentSectionProps) {
  const { t } = useTranslation("blog");
  const viewer = getAuthUser();
  const isPublished = status === "PUBLISHED";
  const query = useBlogComments(postId, undefined, { enabled: isPublished });
  const createComment = useCreateBlogComment(postId);

  const comments = query.data?.items ?? [];

  return (
    <section className="card-elevated space-y-6 rounded-2xl border border-border bg-card p-6 lg:p-8">
      <h2 className="flex items-center gap-2 font-heading text-xl text-ink">
        <MessageSquare className="h-5 w-5 text-brand-blue" aria-hidden="true" />
        {t("comments.title")}
      </h2>

      {!isPublished ? (
        /*
          The comments of a draft are not public: the server refuses them.
          The box is not shown, so the member is not invited to write a
          comment that can never be stored.
        */
        <p className="text-sm text-muted-foreground">
          {t("comments.notPublished")}
        </p>
      ) : viewer ? (
        <CommentForm
          submitLabel={t("comments.send")}
          onSubmit={async (content) => {
            try {
              await createComment.mutateAsync({ content });
              toast.success(t("comments.sent"));
            } catch {
              // The reason was already told by the hook (a toast).
            }
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("comments.signInHint")}
        </p>
      )}

      {isPublished && query.isPending ? (
        <p className="text-sm text-muted-foreground">{t("comments.loading")}</p>
      ) : isPublished && comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>
      ) : isPublished ? (
        <ul className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              depth={0}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default CommentSection;
