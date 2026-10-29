/**
 * Media module types
 *
 * The slides of the landing page: the images the admin shows in the
 * hero of the platform and the order in which they rotate.
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/media`): a field that the server does not send cannot
 * be read by the page, and the compiler says so.
 */

import type { z } from "zod";

import type {
  landingSlideAdminItemSchema,
  landingSlidePublicItemSchema,
} from "@/lib/schemas/media";

export type LandingSlide = z.infer<typeof landingSlidePublicItemSchema>;

export type LandingSlideAdminItem = z.infer<typeof landingSlideAdminItemSchema>;

export interface MediaSlideListParams {
  page?: number;
  size?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}
