/**
 * React Query key factories for the bible module.
 *
 * Keys are hierarchical tuples rooted at ["bible"] so every hook
 * reads/writes through these factories and invalidation stays precise.
 */
import type { BibleVersesListParams, PublishedVersesParams } from "../types";

export const bibleKeys = {
  all: ["bible"] as const,
  verses: () => [...bibleKeys.all, "verses"] as const,
  verseList: (params?: BibleVersesListParams) =>
    [...bibleKeys.verses(), "list", params ?? {}] as const,
  stats: () => [...bibleKeys.all, "stats"] as const,
  current: () => [...bibleKeys.all, "current"] as const,
  published: (params?: PublishedVersesParams) =>
    [...bibleKeys.all, "published", params ?? {}] as const,
  detail: (verseId: string) =>
    [...bibleKeys.verses(), verseId] as const,
  schedule: (verseId: string) =>
    [...bibleKeys.verses(), verseId, "schedule"] as const,
};
