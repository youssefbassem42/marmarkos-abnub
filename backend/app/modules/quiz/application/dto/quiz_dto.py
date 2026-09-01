"""Quiz content DTOs (Part 1 §5.4, P5-023).

Validation mirrors BR-19..BR-22. Correct answers are never exposed on
the member take path — only through the graded result (BR-28, §10).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.modules.quiz.domain.enums import QuizStatus


class QuizOptionRequest(BaseModel):
    """One option inside a question payload (P5-023)."""

    id: uuid.UUID | None = Field(
        default=None, description="Existing option id (present for edits, D-13)"
    )
    option_text: str = Field(min_length=1, max_length=500, description="Option text (≤500)")
    is_correct: bool = Field(default=False, description="Whether this is the correct option")
    position: int | None = Field(default=None, ge=1, description="Display order")


class QuizQuestionRequest(BaseModel):
    """One question inside a create/update quiz payload."""

    question: str = Field(min_length=1, max_length=2000, description="Question text (≤2000)")
    points: int = Field(ge=1, le=100, description="Points (1–100)")
    options: list[QuizOptionRequest] = Field(
        min_length=2,
        max_length=6,
        description="2–6 options; exactly one marked correct",
    )

    @model_validator(mode="after")
    def _exactly_one_correct(self) -> "QuizQuestionRequest":
        correct = sum(1 for o in self.options if o.is_correct)
        if correct != 1:
            raise ValueError("exactly one option must be marked correct")
        return self


class CreateQuizRequest(BaseModel):
    """POST /quizzes body (BR-18: at most one quiz per verse)."""

    verse_id: uuid.UUID = Field(description="Parent verse id")
    title: str = Field(min_length=1, max_length=100, description="Quiz title (≤100)")
    description: str | None = Field(default=None, max_length=2000, description="Description")
    duration_seconds: int = Field(ge=30, le=7200, description="Time limit in seconds")
    status: QuizStatus | None = Field(
        default=None, description="Save as DRAFT (default) or PUBLISHED immediately"
    )
    questions: list[QuizQuestionRequest] = Field(
        default_factory=list, max_length=50, description="Initial questions"
    )


class UpdateQuizRequest(BaseModel):
    """PATCH /quizzes/{id} body — all fields optional."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    duration_seconds: int | None = Field(default=None, ge=30, le=7200)


class QuestionOptionResponse(BaseModel):
    id: uuid.UUID = Field(description="Option id")
    option_text: str = Field(description="Option text")
    is_correct: bool = Field(description="Correct flag (manager side only)")
    position: int = Field(description="Display order")


class QuestionResponse(BaseModel):
    id: uuid.UUID = Field(description="Question id")
    question: str = Field(description="Question text")
    points: int = Field(description="Points")
    position: int = Field(description="Display order")
    options: list[QuestionOptionResponse] = Field(description="Options (with correctness)")


class QuizAdminItem(BaseModel):
    """Manager table row (GET /quizzes)."""

    id: uuid.UUID = Field(description="Quiz id")
    title: str = Field(description="Quiz title")
    verse_id: uuid.UUID = Field(description="Parent verse id")
    verse_reference: str = Field(description="Scripture reference of the verse")
    total_points: int = Field(ge=0, description="Derived sum of question points")
    duration_seconds: int = Field(ge=30, le=7200, description="Time limit")
    question_count: int = Field(ge=0, description="Number of questions")
    status: QuizStatus = Field(description="Lifecycle status")
    published_at: datetime | None = Field(default=None, description="First publish time")
    created_at: datetime = Field(description="Creation timestamp")


class QuizDetailResponse(QuizAdminItem):
    description: str | None = Field(default=None, description="Quiz description")
    questions: list[QuestionResponse] = Field(
        default_factory=list, description="Questions with options"
    )


class QuizValidationRule(BaseModel):
    code: str = Field(description="Machine rule code")
    passed: bool = Field(description="Whether the rule passes")
    detail: str = Field(description="Human-readable outcome")


class QuizValidationResponse(BaseModel):
    is_publishable: bool = Field(description="True when publish is allowed (BR-21)")
    rules: list[QuizValidationRule] = Field(description="Readiness panel per-rule status")
