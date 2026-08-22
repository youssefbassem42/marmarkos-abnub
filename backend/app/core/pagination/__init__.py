"""Shared pagination primitives for list endpoints.

Framework-agnostic, module-independent infrastructure: ``PageParams``
parses/validates the incoming ``page``/``size`` request values and
``Page[T]`` wraps any item type with the standard envelope
(``items/total/page/size/pages/has_next``).
"""

import math
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PageParams(BaseModel):
    """Validated pagination input shared by all list endpoints."""

    page: int = Field(1, ge=1, description="1-based page number")
    size: int = Field(20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        """Number of rows to skip for this page."""
        return (self.page - 1) * self.size


class Page(BaseModel, Generic[T]):  # noqa: UP046 - Generic[T] kept for pydantic runtime safety
    """Standard paginated response envelope."""

    items: list[T]
    total: int = Field(..., ge=0, description="Total items across all pages")
    page: int = Field(..., ge=1)
    size: int = Field(..., ge=1)
    pages: int = Field(..., ge=0, description="Total pages for the filter set")
    has_next: bool = Field(..., description="True when a further page exists")

    @classmethod
    def build(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        """Assemble a Page from raw results and validated params."""
        pages = math.ceil(total / params.size) if total else 0
        return cls(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            pages=pages,
            has_next=params.page < pages,
        )
