/**
 * The answers of the landing slides.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/media/application/dto/landing_slide_dto.py`).
 */

import { z } from "zod";

import { loose, paginated } from "./common";

/** One slide as the member sees it (the public fields only). */
export const landingSlidePublicItemSchema = loose({
  id: z.string(),
  image: z.string(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  order: z.number(),
});

/** One slide as the admin sees it (the active flag and the timestamps too). */
export const landingSlideAdminItemSchema = loose({
  id: z.string(),
  image: z.string(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  order: z.number(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** The paginated list of the slides of the administration. */
export const landingSlideAdminPageSchema = paginated(
  landingSlideAdminItemSchema,
);

/** The paginated list of the slides of the landing page. */
export const landingSlidePublicPageSchema = paginated(
  landingSlidePublicItemSchema,
);
