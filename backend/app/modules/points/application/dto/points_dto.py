"""Points response DTOs (Part 1 §5.6, P5-032)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.pagination import Page


class PointsResponse(BaseModel):
    """GET /users/me/points."""

    lifetime: int = Field(ge=0, description="Lifetime points (BR-34)")
    this_week: int = Field(ge=0, description="Points this ISO week")
    this_month: int = Field(ge=0, description="Points this calendar month")
    quizzes_completed: int = Field(ge=0, description="Finished attempts")
    average_score_out_of_10: float = Field(description="Average score /10 across attempts")


class MonthlyPointsItem(BaseModel):
    period_month: date = Field(description="First day of the month (platform-local)")
    points: int = Field(ge=0, description="Points earned that month")
    quizzes_completed: int = Field(ge=0, description="Finished attempts that month")


class MonthlyPointsResponse(BaseModel):
    items: list[MonthlyPointsItem] = Field(description="Chronological month series")


class PointActivityItem(BaseModel):
    id: uuid.UUID = Field(description="Ledger transaction id")
    points: int = Field(ge=0, description="Points awarded")
    awarded_at: datetime = Field(description="Award moment (UTC)")
    quiz_id: uuid.UUID | None = Field(default=None, description="Quiz id")
    quiz_title: str | None = Field(default=None, description="Quiz title")
    verse_id: uuid.UUID | None = Field(default=None, description="Verse id")
    verse_reference: str | None = Field(default=None, description="Verse reference")
    source: str = Field(description="Point source")


class PointsByQuizItem(BaseModel):
    """One line of GET /users/me/points/by-quiz: the points of one quiz."""

    quiz_id: uuid.UUID = Field(description="The quiz")
    quiz_title: str = Field(description="The current title of the quiz")
    points: int = Field(ge=0, description="The sum of the ledger on this quiz")
    attempts: int = Field(ge=0, description="The number of the paid attempts on this quiz")
    average_score_out_of_10: float = Field(
        description="The average of the scores out of ten of the graded attempts"
    )
    last_attempt_at: datetime = Field(description="The date of the last attempt")


class PointsByQuizPage(Page[PointsByQuizItem]):
    """A page of the points per quiz plus the lifetime total of the member.

    The envelope is the standard ``Page`` of the platform
    (``items/total/page/size/pages/has_next``) with the lifetime total
    next to it, so the frontend never recomputes the member's total.
    """

    total_points: int = Field(ge=0, description="The lifetime total of the member")
