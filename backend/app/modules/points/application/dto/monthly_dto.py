"""Monthly analytics DTOs (P5-035, §5.7, BR-39)."""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class TrendPoint(BaseModel):
    period_month: date = Field(description="First day of the month")
    total_points: int = Field(ge=0, description="Total points awarded that month")
    participants: int = Field(ge=0, description="Distinct users with attempts")
    average_score_out_of_10: float = Field(description="Average score /10")


class CompletionBucket(BaseModel):
    bucket: str = Field(description="100% / 75–99% / 50–74% / <50%")
    users: int = Field(ge=0, description="User count in this bucket")
    percentage: float = Field(description="Share of users (0–100)")


class TopUser(BaseModel):
    rank: int = Field(ge=1, description="Dense rank")
    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    avatar: str | None = Field(default=None, description="Avatar URL")
    points: int = Field(ge=0, description="Points earned that month")


class MonthlyAnalyticsResponse(BaseModel):
    """GET /quiz-analytics/monthly."""

    month: date = Field(description="First day of the requested month")
    participants: int = Field(ge=0, description="Distinct users with attempts")
    quizzes_completed: int = Field(ge=0, description="Finished attempts")
    total_points: int = Field(ge=0, description="Points awarded that month")
    average_score_out_of_10: float = Field(description="Average score /10")
    quizzes_published: int = Field(ge=0, description="Quizzes published that month")
    trend: list[TrendPoint] = Field(description="Last 3 months trend")
    completion_distribution: list[CompletionBucket] = Field(
        description="Completion-rate distribution"
    )
    top: list[TopUser] = Field(description="Top 3 users by points")


class SparklineItem(BaseModel):
    user_id: uuid.UUID = Field(description="User id")
    values: list[int] = Field(description="6-month point values (oldest → newest)")


class MonthlyUserItem(BaseModel):
    rank: int = Field(ge=1, description="Dense rank by points desc")
    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    avatar: str | None = Field(default=None, description="Avatar URL")
    quizzes_completed: int = Field(ge=0, description="Finished attempts")
    average_score_out_of_10: float = Field(description="Average score /10")
    total_points: int = Field(ge=0, description="Points earned that month")
    completion_rate: float = Field(description="finished / published (0–100)")
    sparkline: list[int] = Field(description="6-month point values")


class QuizBreakdownItem(BaseModel):
    quiz_id: uuid.UUID = Field(description="Quiz id")
    quiz_title: str = Field(description="Quiz title")
    score: int = Field(ge=0, description="Raw score")
    total_points: int = Field(ge=0, description="Quiz total points")
    score_out_of_10: float = Field(description="Normalised /10")


class MonthHistoryPoint(BaseModel):
    period_month: date = Field(description="First day of the month")
    points: int = Field(ge=0, description="Points earned")


class MonthlyUserDetailResponse(BaseModel):
    """GET /quiz-analytics/users/{user_id}."""

    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    avatar: str | None = Field(default=None, description="Avatar URL")
    month: date = Field(description="Requested month")
    total_points: int = Field(ge=0, description="Points that month")
    quizzes_completed: int = Field(ge=0, description="Finished attempts")
    average_score_out_of_10: float = Field(description="Average score /10")
    completion_rate: float = Field(description="finished / published (0–100)")
    breakdown: list[QuizBreakdownItem] = Field(description="Per-quiz results")
    history: list[MonthHistoryPoint] = Field(description="Full month history")
