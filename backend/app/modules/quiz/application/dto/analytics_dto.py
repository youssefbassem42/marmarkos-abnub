"""Quiz analytics DTOs (Part 1 §5.7, P5-034)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.quiz.domain.enums import AttemptStatus


class ScoreDistributionBucket(BaseModel):
    score: int = Field(ge=0, description="Raw score value")
    users: int = Field(ge=0, description="Count of attempts at this score")


class CompletionStatusBucket(BaseModel):
    status: AttemptStatus = Field(description="COMPLETED or AUTO_FINISHED")
    users: int = Field(ge=0, description="Count in this status")
    percentage: float = Field(description="Share of finished attempts (0–100)")


class QuizAnalyticsResponse(BaseModel):
    """GET /quizzes/{id}/analytics."""

    participants: int = Field(ge=0, description="Finished attempts")
    completed: int = Field(ge=0, description="COMPLETED attempts")
    auto_finished: int = Field(ge=0, description="AUTO_FINISHED attempts")
    average_score_out_of_10: float = Field(description="Average score /10")
    highest_score: int = Field(ge=0, description="Best raw score")
    lowest_score: int = Field(ge=0, description="Worst raw score")
    total_points_awarded: int = Field(ge=0, description="Ledger points awarded")
    max_possible_points: int = Field(ge=0, description="Snapshot of the quiz total")
    score_distribution: list[ScoreDistributionBucket] = Field(
        description="Densified buckets from max down to 0"
    )
    completion_status: list[CompletionStatusBucket] = Field(
        description="Counts + percentages per completion status"
    )


class QuizUserResultItem(BaseModel):
    """Per-user result row (GET /quizzes/{id}/analytics/users)."""

    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    email: str = Field(description="Account email")
    avatar: str | None = Field(default=None, description="Avatar URL")
    score: int = Field(ge=0, description="Raw score")
    total_points: int = Field(ge=0, description="Snapshotted total points")
    percentage: float = Field(description="Percentage score")
    points_awarded: int = Field(ge=0, description="Ledger points")
    status: AttemptStatus = Field(description="Completion status")
    finished_at: datetime = Field(description="Finish moment (UTC)")
    time_taken_seconds: int = Field(ge=0, description="seconds(start→finish)")


class AttemptUserBlock(BaseModel):
    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    email: str = Field(description="Account email")
    avatar: str | None = Field(default=None, description="Avatar URL")


class ManagerAttemptReviewResponse(BaseModel):
    """GET /quiz-attempts/{id}/review — manager view of one attempt (P5-034)."""

    attempt_id: uuid.UUID = Field(description="Attempt id")
    quiz_id: uuid.UUID = Field(description="Quiz id")
    verse_id: uuid.UUID | None = Field(default=None, description="Verse id")
    status: AttemptStatus = Field(description="Completion status")
    score: int = Field(ge=0, description="Raw score")
    total_points: int = Field(ge=0, description="Snapshotted total points")
    score_out_of_10: float = Field(description="Normalised /10")
    percentage: float = Field(description="Percentage")
    correct_count: int = Field(ge=0, description="Correct answers")
    incorrect_count: int = Field(ge=0, description="Incorrect/unanswered")
    question_count: int = Field(ge=0, description="Total questions")
    points_awarded: int = Field(ge=0, description="Ledger points")
    finished_at: datetime = Field(description="Finish moment (UTC)")
    time_taken_seconds: int = Field(ge=0, description="seconds(start→finish)")
    user: AttemptUserBlock = Field(description="The attempt's user")
    review: list["ReviewItem"] = Field(description="Question-by-question review")


class ReviewItem(BaseModel):
    question_id: uuid.UUID = Field(description="Question id")
    position: int = Field(description="Display order")
    question: str = Field(description="Question text")
    points: int = Field(description="Points")
    selected_option_id: uuid.UUID | None = Field(description="Caller's selection")
    correct_option_id: uuid.UUID | None = Field(description="Correct option")
    is_correct: bool = Field(description="Whether the answer was correct")
    points_awarded: int = Field(ge=0, description="Points earned here")
    options: list["ReviewOption"] = Field(description="Options with correctness")


class ReviewOption(BaseModel):
    id: uuid.UUID = Field(description="Option id")
    option_text: str = Field(description="Option text")
    position: int = Field(description="Display order")
    is_correct: bool = Field(description="Correct flag")


ManagerAttemptReviewResponse.model_rebuild()
