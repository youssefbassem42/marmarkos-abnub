"""Quiz attempt DTOs (Part 1 §5.5, P5-027/028).

Correct answers are never included on the take/resume path; they appear
only in the graded result for a finished attempt owned by the caller
(BR-28, §10). ``is_correct`` never appears in an in-progress payload.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus


class TakeQuestionItem(BaseModel):
    """One question on the member take path (no correctness)."""

    id: uuid.UUID = Field(description="Question id")
    question: str = Field(description="Question text")
    points: int = Field(description="Points")
    position: int = Field(description="Display order")
    answered: bool = Field(default=False, description="Caller already answered (resume)")
    selected_option_id: uuid.UUID | None = Field(
        default=None, description="Caller's stored selection (resume)"
    )
    options: list["TakeOptionItem"] = Field(description="Options without correctness")


class TakeOptionItem(BaseModel):
    id: uuid.UUID = Field(description="Option id")
    option_text: str = Field(description="Option text")
    position: int = Field(description="Display order")


class AttemptStartResponse(BaseModel):
    """POST /quizzes/{id}/attempts (P5-028)."""

    id: uuid.UUID = Field(description="Attempt id")
    quiz_id: uuid.UUID = Field(description="Quiz id")
    started_at: datetime = Field(description="Start moment (UTC)")
    expires_at: datetime = Field(description="Deadline (UTC)")
    remaining_seconds: int = Field(ge=0, description="Seconds left")
    server_time: datetime = Field(description="Server clock")
    duration_seconds: int = Field(description="Time limit")
    total_points: int = Field(description="Snapshot of quiz total points")
    question_count: int = Field(description="Number of questions")
    questions: list[TakeQuestionItem] = Field(description="Questions without correctness")


class AttemptResumeResponse(AttemptStartResponse):
    """GET /quiz-attempts/{id} — adds attempt state."""

    status: AttemptStatus = Field(description="Current lifecycle status")


class SaveAnswerRequest(BaseModel):
    selected_option_id: uuid.UUID = Field(description="The option selected by the member")


class StartAttemptRequest(BaseModel):
    quiz_id: uuid.UUID = Field(description="Quiz to begin an attempt for")


class GradedOptionItem(BaseModel):
    id: uuid.UUID = Field(description="Option id")
    option_text: str = Field(description="Option text")
    position: int = Field(description="Display order")
    is_correct: bool = Field(description="Correct flag")


class ReviewQuestionItem(BaseModel):
    question_id: uuid.UUID = Field(description="Question id")
    position: int = Field(description="Display order")
    question: str = Field(description="Question text")
    points: int = Field(description="Points")
    selected_option_id: uuid.UUID | None = Field(description="Caller's selection")
    correct_option_id: uuid.UUID | None = Field(description="Correct option")
    is_correct: bool = Field(description="Whether the answer was correct")
    points_awarded: int = Field(ge=0, description="Points earned on this question")
    options: list[GradedOptionItem] = Field(description="All options with correctness")


class PointsSnapshot(BaseModel):
    week_before: int = Field(ge=0, description="Week points before this attempt")
    week_after: int = Field(ge=0, description="Week points after awarding")
    month_before: int = Field(ge=0, description="Month points before")
    month_after: int = Field(ge=0, description="Month points after")
    lifetime_before: int = Field(ge=0, description="Lifetime points before")
    lifetime_after: int = Field(ge=0, description="Lifetime points after")


class AttemptResultResponse(BaseModel):
    """Graded result for a finished attempt (owner only, BR-29)."""

    attempt_id: uuid.UUID = Field(description="Attempt id")
    quiz_id: uuid.UUID = Field(description="Quiz id")
    verse_id: uuid.UUID | None = Field(default=None, description="Verse id")
    status: AttemptStatus = Field(description="COMPLETED or AUTO_FINISHED")
    score: int = Field(ge=0, description="Points earned")
    total_points: int = Field(ge=0, description="Snapshotted total points")
    score_out_of_10: float = Field(description="Normalised score /10")
    percentage: float = Field(description="Percentage score")
    correct_count: int = Field(ge=0, description="Correct answers")
    incorrect_count: int = Field(ge=0, description="Incorrect/unanswered")
    question_count: int = Field(ge=0, description="Total questions")
    points_awarded: int = Field(ge=0, description="Ledger points awarded (BR-35)")
    finished_at: datetime = Field(description="Finish moment (UTC)")
    time_taken_seconds: int = Field(ge=0, description="seconds(start→finish)")
    points: PointsSnapshot = Field(description="Points before/after snapshot")
    review: list[ReviewQuestionItem] = Field(
        description="Question-by-question review with correctness (owner only)"
    )


class QuizTakeResponse(BaseModel):
    """Member quiz take page head (used by getQuizForTake)."""

    id: uuid.UUID = Field(description="Quiz id")
    title: str = Field(description="Quiz title")
    description: str | None = Field(default=None, description="Quiz description")
    duration_seconds: int = Field(description="Time limit")
    total_points: int = Field(description="Total points")
    question_count: int = Field(description="Number of questions")
    questions: list[TakeQuestionItem] = Field(description="Questions without correctness")


class AttemptState(BaseModel):
    """Embedded attempt state on the member quiz summary card (P5-027)."""

    attempt_id: uuid.UUID = Field(description="Attempt id")
    status: AttemptStatus = Field(description="Lifecycle state")


class QuizSummaryResponse(BaseModel):
    """GET /bible-verses/{verse_id}/quiz/summary (P5-027)."""

    quiz_id: uuid.UUID = Field(description="Quiz id")
    title: str = Field(description="Quiz title")
    description: str | None = Field(default=None, description="Quiz description")
    question_count: int = Field(description="Number of questions")
    total_points: int = Field(description="Total points")
    duration_seconds: int = Field(description="Time limit")
    is_available: bool = Field(description="Quiz is PUBLISHED and available")
    requires_read: bool = Field(description="Verse must be read before starting (D-6)")
    has_read: bool = Field(description="Caller has marked the verse read")
    attempt: AttemptState | None = Field(default=None, description="Existing attempt state")
