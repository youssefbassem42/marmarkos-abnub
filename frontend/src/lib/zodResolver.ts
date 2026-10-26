/**
 * Minimal Zod → react-hook-form resolver.
 *
 * Why not `@hookform/resolvers`?
 * -----------------------------
 * The v6 line (the only one that supports Zod 4) declares an optional peer
 * on `effect@^4`, while the `@typeschema/main` package it pulls in pins
 * `effect@^3`. npm refuses to resolve both, and the only ways out are
 * `--legacy-peer-deps` (which disables *every* peer check in CI) or
 * `--force`. This adapter is ~40 lines, has no dependencies, and is
 * covered by its own unit tests.
 *
 * Behaviour matches `@hookform/resolvers/zod`:
 *   - on success the *parsed* values are returned (so `.trim()` and
 *     `z.coerce` transformations reach the form state),
 *   - on failure every issue becomes a field error, keyed by the issue
 *     path ("options.0.optionText"), first issue per path wins.
 */

import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";

export interface ZodIssueLike {
  readonly path: PropertyKey[];
  readonly message: string;
}

export type ZodSchemaLike<TOutput> = {
  safeParse: (
    values: unknown,
  ) =>
    | { success: true; data: TOutput }
    | { success: false; error: { issues: readonly ZodIssueLike[] } };
};

export interface ZodResolverError {
  type: string;
  message: string;
}

/** Build a react-hook-form resolver for a Zod schema. */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: ZodSchemaLike<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, ZodResolverError> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      if (!(path in errors)) {
        errors[path] = { type: "validation", message: issue.message };
      }
    }

    // `values` stays empty on failure: react-hook-form keeps the current
    // form state until the user fixes the invalid fields.
    return { values: {}, errors: errors as FieldErrors<TFieldValues> };
  };
}
