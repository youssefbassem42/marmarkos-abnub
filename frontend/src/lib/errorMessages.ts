import type { TFunction } from "i18next";

import { apiServerMessageKeys } from "@/i18n/resources/ar";
import { toApiError } from "@/lib/api";

/**
 * The translator reads the copy of the `errors` namespace. The namespace
 * is typed loosely on purpose: the keys are looked up by name (they come
 * from the map of the server messages), and a missing key must never
 * break the type checker of a component.
 */
type ErrorTranslator = TFunction<"errors", undefined>;

export type ErrorKind = "user" | "server" | "network";

export interface DescribedError {
  /** Arabic copy that is ready to show to a member. */
  message: string;
  /** Who must act: the member, the platform team, or the connection. */
  kind: ErrorKind;
  /** Machine code returned by the backend, when one was received. */
  code?: string;
  /** HTTP status returned by the backend, when a response was received. */
  status?: number;
}

interface ErrorDescription {
  key: string;
  kind: ErrorKind;
}

/** Every application code declared by the backend, plus the client codes. */
const CODE_DESCRIPTIONS: Record<string, ErrorDescription> = {
  validation_error: { key: "api.invalidData", kind: "user" },
  unauthorized: { key: "api.sessionExpired", kind: "user" },
  forbidden: { key: "api.noPermission", kind: "user" },
  not_found: { key: "api.notFound", kind: "user" },
  conflict: { key: "api.alreadyDone", kind: "user" },
  rate_limited: { key: "api.tooManyAttempts", kind: "user" },
  email_not_verified: { key: "api.emailNotVerified", kind: "user" },
  account_inactive: { key: "api.accountInactive", kind: "user" },
  internal_error: { key: "api.serverError", kind: "server" },
  invalid_status_transition: {
    key: "api.invalidStatusTransition",
    kind: "user",
  },
  invalid_schedule: { key: "api.invalidSchedule", kind: "user" },
  schedule_exists: { key: "api.verseAlreadyScheduled", kind: "user" },
  quiz_exists: { key: "api.quizAlreadyExists", kind: "user" },
  quiz_not_publishable: {
    key: "api.quizNotPublishable",
    kind: "user",
  },
  quiz_not_available: { key: "api.quizNotAvailable", kind: "user" },
  verse_not_read: { key: "api.verseNotRead", kind: "user" },
  attempt_exists: { key: "api.attemptAlreadyExists", kind: "user" },
  budget_exhausted: { key: "api.budgetExhausted", kind: "user" },
  attempt_finished: { key: "api.attemptAlreadyFinished", kind: "user" },
  invalid_option: { key: "api.invalidOption", kind: "user" },
  invalid_reorder: { key: "api.invalidReorder", kind: "user" },
  export_too_large: { key: "api.exportTooLarge", kind: "user" },
  scheduler_disabled: { key: "api.serverError", kind: "server" },
  invalid_response: { key: "api.serverError", kind: "server" },
};

const STATUS_DESCRIPTIONS: Record<number, ErrorDescription> = {
  401: { key: "api.sessionExpired", kind: "user" },
  403: { key: "api.noPermission", kind: "user" },
  404: { key: "api.notFound", kind: "user" },
  409: { key: "api.alreadyDone", kind: "user" },
  413: { key: "api.tooLarge", kind: "user" },
  422: { key: "api.invalidData", kind: "user" },
  429: { key: "api.tooManyAttempts", kind: "user" },
};

function translate(t: ErrorTranslator, key: string): string {
  return t(key as never) as string;
}

function statusDescription(status: number): ErrorDescription | undefined {
  const exact = STATUS_DESCRIPTIONS[status];
  if (exact) return exact;
  if (status >= 500) {
    return { key: "api.serverError", kind: "server" };
  }
  if (status >= 400) {
    return { key: "api.invalidData", kind: "user" };
  }
  if (status === 0) {
    return { key: "api.network", kind: "network" };
  }
  return undefined;
}

/**
 * Turn any failure into Arabic copy that says what happened and who must
 * act. The backend code has priority, the HTTP status is the fallback,
 * and a known server sentence refines the generic code with the exact
 * reason supplied by the server.
 */
export function describeApiError(
  error: unknown,
  t: ErrorTranslator,
): DescribedError {
  const apiError = toApiError(error);
  const codeDescription = apiError.code
    ? CODE_DESCRIPTIONS[apiError.code]
    : undefined;
  const fallbackDescription = statusDescription(apiError.status);
  const description = codeDescription ?? fallbackDescription;

  const knownMessageKey = (apiServerMessageKeys as Record<string, string>)[
    apiError.message
  ];

  const key = knownMessageKey ?? description?.key ?? "unknown";
  const kind = description?.kind ?? "network";
  const message = translate(t, key);

  return {
    message,
    kind,
    ...(apiError.code ? { code: apiError.code } : {}),
    ...(apiError.status > 0 ? { status: apiError.status } : {}),
  };
}
