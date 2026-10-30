/**
 * The answers of the blog.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/blog/application/dto/post_dto.py`).  Every answer is
 * checked at the edge of the API before a page reads it.
 */

import { z } from "zod";

import { loose } from "./common";

/** The lifecycle state of a post. */
export const blogPostStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** One tag (the interface name of a blog category). */
export const blogTagSchema = loose({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

/** The public identity of the author of a post. */
export const blogAuthorSchema = loose({
  id: z.string(),
  full_name: z.string(),
});

/** A published post in the member-facing list. */
export const blogPostSummarySchema = loose({
  id: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  cover_image: z.string().nullable(),
  tags: z.array(blogTagSchema),
  published_at: z.string().nullable(),
  author: blogAuthorSchema,
});

/** The detail of a published post. */
export const blogPostDetailSchema = loose({
  id: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  body: z.string(),
  cover_image: z.string().nullable(),
  tags: z.array(blogTagSchema),
  published_at: z.string().nullable(),
  author: blogAuthorSchema,
});

/** A post as the administration sees it. */
export const blogPostAdminSchema = loose({
  id: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  body: z.string(),
  cover_image: z.string().nullable(),
  tags: z.array(blogTagSchema),
  status: blogPostStatusSchema,
  published_at: z.string().nullable(),
  author: blogAuthorSchema,
  author_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** The secure URL returned after a cover upload. */
export const blogImageUploadSchema = loose({
  url: z.string(),
});

/** The public identity of the author of a comment. */
export const blogCommentAuthorSchema = loose({
  id: z.string(),
  full_name: z.string(),
});

/**
 * The fields of a comment before its replies are attached.
 *
 * The tree is recursive, so the replies are added by the lazy schema
 * below. Keeping the flat fields in their own schema lets TypeScript
 * infer every field of a comment from zod (the answer type is never
 * written twice).
 */
const blogCommentBaseSchema = loose({
  id: z.string(),
  post_id: z.string(),
  parent_comment_id: z.string().nullable(),
  content: z.string(),
  status: z.string(),
  author: blogCommentAuthorSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

type BlogCommentValue = z.infer<typeof blogCommentBaseSchema> & {
  replies: BlogCommentValue[];
};

/** One comment and the replies nested underneath it (BR-80). */
export const blogCommentSchema = z.lazy((): z.ZodType<BlogCommentValue> =>
  loose({
    ...blogCommentBaseSchema.shape,
    replies: z.array(blogCommentSchema),
  }),
);
