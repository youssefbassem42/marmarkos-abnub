/**
 * The shape of the answers of the API.
 *
 * The frontend used to trust the answers of the server: a field that
 * was renamed, removed or became null reached the page as `undefined`,
 * and the page read `data.total_present.toFixed(1)` - a `TypeError`
 * that **crashed the whole screen** (the board of the attendance, the
 * page of the check-in, the page of the attempt).
 *
 * A schema turns that crash into a message: the answer is checked at
 * the edge of the API, and an answer that does not have the expected
 * shape becomes an `ApiError` - the page shows its error state (and its
 * "try again" button) instead of a white screen.
 *
 * The rules of the house:
 *
 * * a schema mirrors the **backend** (its DTO is the source of truth),
 *   never the hope of the frontend;
 * * the unknown fields are **kept** (`looseObject`), so the check never
 *   removes a field the page reads;
 * * a schema is **opt-in**: an endpoint without a schema behaves exactly
 *   as before.
 */

import { z } from "zod";

/**
 * An object that keeps the fields it does not know about.
 *
 * `z.object()` in zod 4 **removes** the unknown keys: a schema would
 * then silently strip the fields the page reads. `looseObject` keeps
 * them, and the check stays a check.
 */
export function loose<T extends z.ZodRawShape>(shape: T) {
  return z.looseObject(shape);
}

/** A date of the API (ISO 8601). */
export const isoDate = z.string();

/** A date and a time of the API (ISO 8601). */
export const isoDateTime = z.string();

/** A UUID. */
export const uuid = z.string();

/** A number that the API sends as a number. */
export const count = z.number();

/** A number that the API may send as null. */
export const nullableCount = z.number().nullable();

/** A string that the API may send as null. */
export const nullableText = z.string().nullable();
