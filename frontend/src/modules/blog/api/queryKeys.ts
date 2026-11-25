/** React Query key factories for the blog module. */

import type { BlogCommentsListParams, BlogPostsListParams } from "../types";

export const blogKeys = {
  all: ["blog"] as const,
  posts: () => [...blogKeys.all, "posts"] as const,
<<<<<<< HEAD
  list: (params?: BlogPostsListParams) =>
    [...blogKeys.posts(), "list", params ?? {}] as const,
=======
  publicList: (params?: BlogPostsListParams) =>
    [...blogKeys.posts(), "public", params ?? {}] as const,
  adminList: (params?: AdminBlogPostsListParams) =>
    [...blogKeys.posts(), "admin", params ?? {}] as const,
  commentTrees: () => [...blogKeys.posts(), "comments"] as const,
>>>>>>> 45b32e3 (feat(blog): let members like comments and replies)
  comments: (postId: string, params?: BlogCommentsListParams) =>
    [...blogKeys.commentTrees(), postId, params ?? {}] as const,
  commentLikes: (commentId: string) =>
    [...blogKeys.posts(), "comment-likes", commentId] as const,
  likes: (postId: string) => [...blogKeys.posts(), "likes", postId] as const,
  shortLookup: (shortCode: string) =>
    [...blogKeys.posts(), "short", shortCode] as const,
  detail: (postId: string) => [...blogKeys.posts(), "detail", postId] as const,
  shortLink: (code: string) =>
    [...blogKeys.posts(), "short-link", code] as const,
};
