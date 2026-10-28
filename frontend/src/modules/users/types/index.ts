/**
 * Types of the members.
 *
 * The type is the **inference of the schema** of the answers
 * (`@/lib/schemas/member`): the backend is the source of truth, and a
 * field that the server does not send cannot be read by the page.
 */

import type { z } from "zod";

import type {
  roleNameSchema,
  userSchema,
  userStatusSchema,
} from "@/lib/schemas/member";

export type UserRole = z.infer<typeof roleNameSchema>;

export type UserStatus = z.infer<typeof userStatusSchema>;

/** A member of the list of the administration (`UserResponse`). */
export type UserAdminItem = z.infer<typeof userSchema>;
