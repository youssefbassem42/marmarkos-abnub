class AppError(Exception):
    """Base error for all expected application failures."""

    status_code: int
    code: str
    message: str

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Not authenticated"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    message = "Insufficient permissions"


class EmailNotVerifiedError(AppError):
    """Credentials are valid but the address has not been confirmed yet."""

    status_code = 403
    code = "email_not_verified"
    message = "Please verify your email address before signing in"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "Resource already exists"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Request could not be processed"


class RateLimitedError(AppError):
    """BR-15: too many anonymous submissions within the sliding window."""

    status_code = 429
    code = "rate_limited"
    message = "Too many messages. Please try again later"

    def __init__(self, message: str | None = None, *, retry_after: int = 60) -> None:
        super().__init__(message)
        self.retry_after = retry_after


# -- Phase 5: bible verses, quizzes, points (Part 1 §5.9) --------------------


class _DataCarryingError(AppError):
    """An ``AppError`` that can carry a structured ``data`` payload.

    The handler merges ``data`` into the ``detail`` object so the client
    sees ``{"detail": {"code", "message", "data"}}`` while every other
    error keeps the unchanged two-key envelope.
    """

    def __init__(
        self, message: str | None = None, *, data: dict[str, object] | None = None
    ) -> None:
        super().__init__(message)
        self.data = data


class InvalidStatusTransitionError(_DataCarryingError):
    """BR-5: a verse/quiz status transition outside the allowed matrix."""

    status_code = 409
    code = "invalid_status_transition"
    message = "This status change is not allowed"


class InvalidScheduleError(AppError):
    """BR-8: scheduled publication date in the past or too far out."""

    status_code = 422
    code = "invalid_schedule"
    message = "Invalid Schedule — you cannot schedule a post in the past"


class ScheduleExistsError(_DataCarryingError):
    """BR-9: the verse already has an active publication schedule."""

    status_code = 409
    code = "schedule_exists"
    message = "This verse already has an active schedule"


class QuizExistsError(_DataCarryingError):
    """D-12: one quiz per verse."""

    status_code = 409
    code = "quiz_exists"
    message = "A quiz already exists for this verse"


class QuizNotPublishableError(_DataCarryingError):
    """BR-21: publish validation failed; ``data.failed_rules`` lists why."""

    status_code = 422
    code = "quiz_not_publishable"
    message = "The quiz is not ready to be published"


class QuizNotAvailableError(AppError):
    """BR-23: verse or quiz is not published for members."""

    status_code = 403
    code = "quiz_not_available"
    message = "This quiz is not available yet"


class VerseNotReadError(AppError):
    """D-6: Mark as Read is required before starting the quiz."""

    status_code = 403
    code = "verse_not_read"
    message = "Mark the Bible verse as read before starting the quiz"


class AttemptExistsError(_DataCarryingError):
    """D-4: one attempt per user per quiz; ``data.attempt_id`` resumes it."""

    status_code = 409
    code = "attempt_exists"
    message = "You have already started this quiz"


class AttemptExpiredError(AppError):
    """BR-26: the server-side timer has passed its grace window."""

    status_code = 409
    code = "attempt_expired"
    message = "Time is up for this attempt"


class AttemptFinishedError(AppError):
    """BR-26: answers can no longer change after submit/auto-finish."""

    status_code = 409
    code = "attempt_finished"
    message = "This attempt has already been finished"


class InvalidOptionError(AppError):
    """BR-26: the selected option does not belong to the question."""

    status_code = 422
    code = "invalid_option"
    message = "The selected option is not valid for this question"


class InvalidReorderError(AppError):
    """P5-025: reorder payload is not a permutation of the questions."""

    status_code = 422
    code = "invalid_reorder"
    message = "The submitted question order is not valid"


class ExportTooLargeError(AppError):
    """BR-40: filtered export exceeds ANALYTICS_EXPORT_MAX_ROWS."""

    status_code = 413
    code = "export_too_large"
    message = "Too many rows to export. Narrow the filters first"


class SchedulerDisabledError(AppError):
    """§5.8: no CRON_SECRET configured and no ADMIN bearer supplied."""

    status_code = 503
    code = "scheduler_disabled"
    message = "The scheduler endpoint is disabled"
