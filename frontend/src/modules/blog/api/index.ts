/**
 * The HTTP client of the blog posts.
 *
 * Every answer is checked against the zod schema that mirrors its backend
 * DTO before it reaches a page.
 */

import { apiClient } from "@/lib/api";
import { paginated } from "@/lib/schemas/common";
import {
  blogImageUploadSchema,
  blogPostAdminSchema,
  blogPostDetailSchema,
  blogPostSummarySchema,
} from "@/lib/schemas/blog";
import type {
  AdminBlogPostsListParams,
  BlogImageUpload,
  BlogPostAdmin,
  BlogPostCreatePayload,
  BlogPostDetail,
  BlogPostSchedulePayload,
  BlogPostSummary,
  BlogPostUpdatePayload,
  BlogPostsListParams,
  Paginated,
} from "../types";

export const blogApi = {
  /** The published posts, with the optional tag and title filters. */
  getPosts: async (
    params?: BlogPostsListParams,
  ): Promise<Paginated<BlogPostSummary>> => {
    const response = await apiClient.get("/blog/posts", {
      params,
      schema: paginated(blogPostSummarySchema),
    });
    return response.data;
  },

  /** One published post. */
  getPost: async (postId: string): Promise<BlogPostDetail> => {
    const response = await apiClient.get(`/blog/posts/${postId}`, {
      schema: blogPostDetailSchema,
    });
    return response.data;
  },

  /** Every post, including drafts, scheduled posts and archived posts. */
  getAdminPosts: async (
    params?: AdminBlogPostsListParams,
  ): Promise<Paginated<BlogPostAdmin>> => {
    const response = await apiClient.get("/admin/blog/posts", {
      params,
      schema: paginated(blogPostAdminSchema),
    });
    return response.data;
  },

  /** Create a draft, or a post with a publication date. */
  createPost: async (data: BlogPostCreatePayload): Promise<BlogPostAdmin> => {
    const response = await apiClient.post("/admin/blog/posts", data, {
      schema: blogPostAdminSchema,
    });
    return response.data;
  },

  /** Update a post; omitted fields stay unchanged on the server. */
  updatePost: async (
    postId: string,
    data: BlogPostUpdatePayload,
  ): Promise<BlogPostAdmin> => {
    const response = await apiClient.patch(
      `/admin/blog/posts/${postId}`,
      data,
      {
        schema: blogPostAdminSchema,
      },
    );
    return response.data;
  },

  /** Archive a post (the deletion is soft). */
  deletePost: async (postId: string): Promise<void> => {
    await apiClient.delete(`/admin/blog/posts/${postId}`);
  },

  /** Publish a post immediately. */
  publishPost: async (postId: string): Promise<BlogPostAdmin> => {
    const response = await apiClient.post(
      `/admin/blog/posts/${postId}/publish`,
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
      `/admin/blog/posts/${postId}/schedule`,
      data,
      { schema: blogPostAdminSchema },
    );
    return response.data;
  },

  /** Upload a cover image (the server enforces the 1 MB limit). */
  uploadCover: async (file: File): Promise<BlogImageUpload> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post("/admin/blog/posts/cover", form, {
      schema: blogImageUploadSchema,
    });
    return response.data;
  },
};
