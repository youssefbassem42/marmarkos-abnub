/**
 * React Query key factories for the media module.
 *
 * Keys are hierarchical tuples rooted at ["media"] so every hook
 * reads/writes through these factories and invalidation stays precise.
 */

import type { MediaSlideListParams } from "../types";

export const mediaKeys = {
  all: ["media"] as const,
  slides: () => [...mediaKeys.all, "slides"] as const,
  adminSlides: (params?: MediaSlideListParams) =>
    [...mediaKeys.slides(), "admin", params ?? {}] as const,
  publicSlides: (params?: MediaSlideListParams) =>
    [...mediaKeys.slides(), "public", params ?? {}] as const,
};
