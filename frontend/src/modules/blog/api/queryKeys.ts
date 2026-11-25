/** React Query key factories for the blog module. */

import type { BlogCommentsListParams, BlogPostsListParams } from "../types";

export const blogKeys = {
  all: ["blog"] as const,
  posts: () => [...blogKeys.all, "posts"] as const,
  list: (params?: BlogPostsListParams) =>
    [...blogKeys.posts(), "list", params ?? {}] as const,
  comments: (postId: string, params?: BlogCommentsListParams) =>
    [...blogKeys.posts(), "comments", postId, params ?? {}] as const,
  likes: (postId: string) => [...blogKeys.posts(), "likes", postId] as const,
  shortLookup: (shortCode: string) =>
    [...blogKeys.posts(), "short", shortCode] as const,
  detail: (postId: string) => [...blogKeys.posts(), "detail", postId] as const,
  shortLink: (code: string) =>
    [...blogKeys.posts(), "short-link", code] as const,
};
