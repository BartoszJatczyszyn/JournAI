from __future__ import annotations

class DomainError(Exception):
    code = "domain_error"
    status_code = 400
    def __init__(self, message: str = "", *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.message = message or self.code

class NotFoundError(DomainError):
    code = "not_found"
    status_code = 404

class TimeoutExceeded(DomainError):
    code = "timeout"
    status_code = 504

__all__ = ["DomainError", "NotFoundError", "TimeoutExceeded"]
