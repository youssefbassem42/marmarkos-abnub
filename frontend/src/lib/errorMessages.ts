import type { TFunction } from "i18next";

import { apiServerMessageKeys } from "@/i18n/resources/ar";
import { toApiError } from "@/lib/api";

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
  validation_error: { key: "errors.api.invalidData", kind: "user" },
  unauthorized: { key: "errors.api.sessionExpired", kind: "user" },
  forbidden: { key: "errors.api.noPermission", kind: "user" },
  not_found: { key: "errors.api.notFound", kind: "user" },
  conflict: { key: "errors.api.alreadyDone", kind: "user" },
  rate_limited: { key: "errors.api.tooManyAttempts", kind: "user" },
  email_not_verified: { key: "errors.api.emailNotVerified", kind: "user" },
  account_inactive: { key: "errors.api.accountInactive", kind: "user" },
  internal_error: { key: "errors.api.serverError", kind: "server" },
  invalid_status_transition: {
    key: "errors.api.invalidStatusTransition",
    kind: "user",
  },
  invalid_schedule: { key: "errors.api.invalidSchedule", kind: "user" },
  schedule_exists: { key: "errors.api.verseAlreadyScheduled", kind: "user" },
  quiz_exists: { key: "errors.api.quizAlreadyExists", kind: "user" },
  quiz_not_publishable: {
    key: "errors.api.quizNotPublishable",
    kind: "user",
  },
  quiz_not_available: { key: "errors.api.quizNotAvailable", kind: "user" },
  verse_not_read: { key: "errors.api.verseNotRead", kind: "user" },
  attempt_exists: { key: "errors.api.attemptAlreadyExists", kind: "user" },
  budget_exhausted: { key: "errors.api.budgetExhausted", kind: "user" },
  attempt_finished: { key: "errors.api.attemptAlreadyFinished", kind: "user" },
  invalid_option: { key: "errors.api.invalidOption", kind: "user" },
  invalid_reorder: { key: "errors.api.invalidReorder", kind: "user" },
  export_too_large: { key: "errors.api.exportTooLarge", kind: "user" },
  scheduler_disabled: { key: "errors.api.serverError", kind: "server" },
  invalid_response: { key: "errors.api.serverError", kind: "server" },
};

const STATUS_DESCRIPTIONS: Record<number, ErrorDescription> = {
  401: { key: "errors.api.sessionExpired", kind: "user" },
  403: { key: "errors.api.noPermission", kind: "user" },
  404: { key: "errors.api.notFound", kind: "user" },
  409: { key: "errors.api.alreadyDone", kind: "user" },
  413: { key: "errors.api.tooLarge", kind: "user" },
  422: { key: "errors.api.invalidData", kind: "user" },
  429: { key: "errors.api.tooManyAttempts", kind: "user" },
};

function translate(t: TFunction, key: string): string {
  return t(key as never) as string;
}

function statusDescription(status: number): ErrorDescription | undefined {
  const exact = STATUS_DESCRIPTIONS[status];
  if (exact) return exact;
  if (status >= 500) {
    return { key: "errors.api.serverError", kind: "server" };
  }
  if (status >= 400) {
    return { key: "errors.api.invalidData", kind: "user" };
  }
  if (status === 0) {
    return { key: "errors.api.network", kind: "network" };
  }
  return undefined;
}

/**
 * Turn any failure into Arabic copy that says what happened and who must
 * act. The backend code has priority, the HTTP status is the fallback,
 * and a known server sentence refines the generic code with the exact
 * reason supplied by the server.
 */
export function describeApiError(error: unknown, t: TFunction): DescribedError {
  const apiError = toApiError(error);
  const codeDescription = apiError.code
    ? CODE_DESCRIPTIONS[apiError.code]
    : undefined;
  const fallbackDescription = statusDescription(apiError.status);
  const description = codeDescription ?? fallbackDescription;

  const knownMessageKey = (apiServerMessageKeys as Record<string, string>)[
    apiError.message
  ];

  const key = knownMessageKey ?? description?.key ?? "errors.unknown";
  const kind = description?.kind ?? "network";
  const message = translate(t, key);

  return {
    message,
    kind,
    ...(apiError.code ? { code: apiError.code } : {}),
    ...(apiError.status > 0 ? { status: apiError.status } : {}),
  };
}
