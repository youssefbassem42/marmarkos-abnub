/**
 * Blog module types.
 *
 * The answer types are inferred from the zod schemas at the edge of the
 * API.  Request types describe the DTOs accepted by the blog endpoints.
 */

import type { z } from "zod";

import type {
  blogAuthorSchema,
  blogCommentAuthorSchema,
  blogCommentSchema,
  blogImageUploadSchema,
  blogPostAdminSchema,
  blogPostDetailSchema,
  blogPostStatusSchema,
  blogPostSummarySchema,
  blogTagSchema,
} from "@/lib/schemas/blog";

export type BlogPostStatus = z.infer<typeof blogPostStatusSchema>;
export type BlogTag = z.infer<typeof blogTagSchema>;
export type BlogAuthor = z.infer<typeof blogAuthorSchema>;
export type BlogPostSummary = z.infer<typeof blogPostSummarySchema>;
export type BlogPostDetail = z.infer<typeof blogPostDetailSchema>;
export type BlogPostAdmin = z.infer<typeof blogPostAdminSchema>;
export type BlogImageUpload = z.infer<typeof blogImageUploadSchema>;
export type BlogCommentAuthor = z.infer<typeof blogCommentAuthorSchema>;
export type BlogComment = z.infer<typeof blogCommentSchema>;

export interface BlogPostsListParams {
  tag?: string;
  q?: string;
  page?: number;
  size?: number;
}

/** The top-level comments are paginated; every root keeps its replies. */
export interface BlogCommentsListParams {
  page?: number;
  size?: number;
}

export interface AdminBlogPostsListParams {
  page?: number;
  size?: number;
}

export interface BlogPostCreatePayload {
  title: string;
  excerpt: string | null;
  body: string;
  cover_image: string | null;
  tags: string[];
  published_at: string | null;
}

export interface BlogPostUpdatePayload {
  title?: string;
  excerpt?: string | null;
  body?: string;
  cover_image?: string | null;
  tags?: string[];
  published_at?: string | null;
}

export interface BlogPostSchedulePayload {
  published_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}
