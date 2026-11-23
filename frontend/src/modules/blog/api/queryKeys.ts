/** React Query key factories for the blog module. */

import type {
  AdminBlogPostsListParams,
  BlogCommentsListParams,
  BlogPostsListParams,
} from "../types";

export const blogKeys = {
  all: ["blog"] as const,
  posts: () => [...blogKeys.all, "posts"] as const,
  publicList: (params?: BlogPostsListParams) =>
    [...blogKeys.posts(), "public", params ?? {}] as const,
  adminList: (params?: AdminBlogPostsListParams) =>
    [...blogKeys.posts(), "admin", params ?? {}] as const,
  comments: (postId: string, params?: BlogCommentsListParams) =>
    [...blogKeys.posts(), "comments", postId, params ?? {}] as const,
  likes: (postId: string) => [...blogKeys.posts(), "likes", postId] as const,
  detail: (postId: string) => [...blogKeys.posts(), "detail", postId] as const,
  adminDetail: (postId: string) =>
    [...blogKeys.posts(), "admin", "detail", postId] as const,
};
