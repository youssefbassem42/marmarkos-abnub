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
