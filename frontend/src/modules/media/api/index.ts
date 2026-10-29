/**
 * Media API client
 *
 * The slides of the landing page: the public list that the hero shows,
 * and the administration that the admin controls (create, edit, delete,
 * activate, reorder).
 */

import { apiClient } from "@/lib/api";
import {
  landingSlideAdminItemSchema,
  landingSlideAdminPageSchema,
  landingSlidePublicItemSchema,
  landingSlidePublicPageSchema,
} from "@/lib/schemas/media";
import type {
  LandingSlide,
  LandingSlideAdminItem,
  MediaSlideListParams,
  Paginated,
} from "../types";

export const mediaApi = {
  /** Every slide (the inactive ones too) for the administration. */
  getAdminSlides: async (
    params?: MediaSlideListParams,
  ): Promise<Paginated<LandingSlideAdminItem>> => {
    const response = await apiClient.get("/admin/landing/slides", {
      params,
      schema: landingSlideAdminPageSchema,
    });
    return response.data;
  },

  /** The active slides, in order — the public fields only. */
  getPublicSlides: async (
    params?: MediaSlideListParams,
  ): Promise<Paginated<LandingSlide>> => {
    const response = await apiClient.get("/landing/slides", {
      params,
      schema: landingSlidePublicPageSchema,
    });
    return response.data;
  },

  /** Upload the image and create a slide (admin only). */
  createSlide: async (data: FormData): Promise<LandingSlideAdminItem> => {
    const response = await apiClient.post("/admin/landing/slides", data, {
      schema: landingSlideAdminItemSchema,
    });
    return response.data;
  },

  /** Update a slide (admin only). A missing field is left unchanged. */
  updateSlide: async (
    slideId: string,
    data: FormData,
  ): Promise<LandingSlideAdminItem> => {
    const response = await apiClient.patch(
      `/admin/landing/slides/${slideId}`,
      data,
      { schema: landingSlideAdminItemSchema },
    );
    return response.data;
  },

  /** Delete a slide (admin only). */
  deleteSlide: async (slideId: string): Promise<void> => {
    await apiClient.delete(`/admin/landing/slides/${slideId}`);
  },

  /** Persist the ids as the new display order (admin only). */
  reorderSlides: async (ids: string[]): Promise<void> => {
    await apiClient.post("/admin/landing/slides/reorder", { ids });
  },
};
