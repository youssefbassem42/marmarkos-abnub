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
