/**
 * The HTTP client of the blog posts.
 *
 * Every answer is checked against the zod schema that mirrors its backend
 * DTO before it reaches a page.
 */


import { apiClient } from "@/lib/api";
import { paginated } from "@/lib/schemas/common";
import {
  blogCommentLikeSchema,
  blogCommentSchema,
  blogImageUploadSchema,
  blogLikeSchema,
  blogPostAdminSchema,
  blogPostDetailSchema,
  blogPostSummarySchema,
  blogShortLinkSchema,
} from "@/lib/schemas/blog";
import type {
  BlogComment,
  BlogCommentCreatePayload,
  BlogCommentUpdatePayload,
  BlogCommentsListParams,
  BlogImageUpload,
  BlogLike,
  BlogPostAdmin,
  BlogPostCreatePayload,
  BlogPostDetail,
  BlogPostSchedulePayload,
  BlogPostSummary,
  BlogPostUpdatePayload,
  BlogPostsListParams,
  BlogShortLink,
  Paginated,
} from "../types";
import type { BlogCommentLike } from "../types";

export const blogApi = {
  /** The blog posts, with the optional tag, title and status filters. */
  getPosts: async (
    params?: BlogPostsListParams,
  ): Promise<Paginated<BlogPostSummary>> => {
    const response = await apiClient.get("/blog/posts", {
      params,
      schema: paginated(blogPostSummarySchema),
    });
    return response.data;
  },

  /** One post (a draft is visible to its author and to the staff). */
  getPost: async (postId: string): Promise<BlogPostDetail> => {
    const response = await apiClient.get(`/blog/posts/${postId}`, {
      schema: blogPostDetailSchema,
    });
    return response.data;
  },

  /** Resolve the stable short address of a post. */
  getShortLink: async (code: string): Promise<BlogShortLink> => {
    const response = await apiClient.get(
      `/blog/posts/short/${encodeURIComponent(code)}`,
      { schema: blogShortLinkSchema },
    );
    return response.data;
  },

  /** The active likes of a published post and the caller's like state. */
  getLikes: async (postId: string): Promise<BlogLike> => {
    const response = await apiClient.get(`/blog/posts/${postId}/likes`, {
      schema: blogLikeSchema,
    });
    return response.data;
  },

  /** Give the post a like as the signed-in member. */
  like: async (postId: string): Promise<BlogLike> => {
    const response = await apiClient.post(
      `/blog/posts/${postId}/like`,
      undefined,
      { schema: blogLikeSchema },
    );
    return response.data;
  },

  /** Take back the signed-in member's like. */
  unlike: async (postId: string): Promise<BlogLike> => {
    const response = await apiClient.delete(`/blog/posts/${postId}/like`, {
      schema: blogLikeSchema,
    });
    return response.data;
  },

  /** The active likes of a comment and the caller's own like state. */
  getCommentLikes: async (commentId: string): Promise<BlogCommentLike> => {
    const response = await apiClient.get(
      `/blog/comments/${encodeURIComponent(commentId)}/likes`,
      { schema: blogCommentLikeSchema },
    );
    return response.data;
  },

  /** Give a comment a like as the signed-in member. */
  likeComment: async (commentId: string): Promise<BlogCommentLike> => {
    const response = await apiClient.post(
      `/blog/comments/${encodeURIComponent(commentId)}/like`,
      undefined,
      { schema: blogCommentLikeSchema },
    );
    return response.data;
  },

  /** Take back the signed-in member's like of a comment. */
  unlikeComment: async (commentId: string): Promise<BlogCommentLike> => {
    const response = await apiClient.delete(
      `/blog/comments/${encodeURIComponent(commentId)}/like`,
      { schema: blogCommentLikeSchema },
    );
    return response.data;
  },

  /** The visible tree of comments for a published post. */
  getComments: async (
    postId: string,
    params?: BlogCommentsListParams,
  ): Promise<Paginated<BlogComment>> => {
    const response = await apiClient.get(`/blog/posts/${postId}/comments`, {
      params,
      schema: paginated(blogCommentSchema),
    });
    return response.data;
  },

  /** Create a top-level comment or a reply. */
  createComment: async (
    postId: string,
    data: BlogCommentCreatePayload,
  ): Promise<BlogComment> => {
    const response = await apiClient.post(
      `/blog/posts/${postId}/comments`,
      data,
      { schema: blogCommentSchema },
    );
    return response.data;
  },

  /** Edit a comment owned by the signed-in member. */
  updateComment: async (
    commentId: string,
    data: BlogCommentUpdatePayload,
  ): Promise<BlogComment> => {
    const response = await apiClient.patch(
      `/blog/comments/${commentId}`,
      data,
      {
        schema: blogCommentSchema,
      },
    );
    return response.data;
  },

  /** Soft-delete a comment; the server keeps its replies in the tree. */
  deleteComment: async (commentId: string): Promise<void> => {
    await apiClient.delete(`/blog/comments/${commentId}`);
  },

  /** Create a draft, or a post with a publication date. */
  createPost: async (data: BlogPostCreatePayload): Promise<BlogPostAdmin> => {
    const response = await apiClient.post("/blog/posts", data, {
      schema: blogPostAdminSchema,
    });
    return response.data;
  },

  /** Update a post; omitted fields stay unchanged on the server. */
  updatePost: async (
    postId: string,
    data: BlogPostUpdatePayload,
  ): Promise<BlogPostAdmin> => {
    const response = await apiClient.patch(`/blog/posts/${postId}`, data, {
      schema: blogPostAdminSchema,
    });
    return response.data;
  },

  /** Archive a post (the deletion is soft). */
  deletePost: async (postId: string): Promise<void> => {
    await apiClient.delete(`/blog/posts/${postId}`);
  },

  /** Publish a post immediately. */
  publishPost: async (postId: string): Promise<BlogPostAdmin> => {
    const response = await apiClient.post(
      `/blog/posts/${postId}/publish`,
      undefined,
      { schema: blogPostAdminSchema },
    );
    return response.data;
  },

  /** Schedule a post for a future date. */
  schedulePost: async (
    postId: string,
    data: BlogPostSchedulePayload,
  ): Promise<BlogPostAdmin> => {
    const response = await apiClient.post(
      `/blog/posts/${postId}/schedule`,
      data,
      { schema: blogPostAdminSchema },
    );
    return response.data;
  },

  /** Upload a cover image (the server enforces the 1 MB limit). */
  uploadCover: async (file: File): Promise<BlogImageUpload> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post("/blog/posts/cover", form, {
      schema: blogImageUploadSchema,
    });
    return response.data;
  },
};
