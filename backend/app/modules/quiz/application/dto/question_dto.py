"""Question DTOs (P5-025, D-13, BR-19/BR-20)."""

import uuid

from pydantic import BaseModel, Field, model_validator

from app.modules.quiz.application.dto.quiz_dto import (
    QuestionOptionResponse,
    QuestionResponse,
    QuizOptionRequest,
    QuizQuestionRequest,
)


class CreateQuestionRequest(BaseModel):
    """POST /quizzes/{id}/questions body."""

    question: str = Field(min_length=1, max_length=2000, description="Question text (≤2000)")
    points: int = Field(ge=1, le=100, description="Points (1–100)")
    options: list[QuizOptionRequest] = Field(
        min_length=2,
        max_length=6,
        description="2–6 options; exactly one correct",
    )

    @model_validator(mode="after")
    def _exactly_one_correct(self) -> "CreateQuestionRequest":
        correct = sum(1 for o in self.options if o.is_correct)
        if correct != 1:
            raise ValueError("exactly one option must be marked correct")
        return self


class UpdateQuestionRequest(BaseModel):
    """PATCH /quiz-questions/{id} body.

    The full options array is submitted; the server diffs against
    existing rows keeping stable ids (D-13).
    """

    question: str | None = Field(default=None, min_length=1, max_length=2000)
    points: int | None = Field(default=None, ge=1, le=100)
    options: list[QuizOptionRequest] | None = Field(
        default=None, min_length=2, max_length=6, description="Full options array"
    )

    @model_validator(mode="after")
    def _exactly_one_correct(self) -> "UpdateQuestionRequest":
        if self.options is not None:
            correct = sum(1 for o in self.options if o.is_correct)
            if correct != 1:
                raise ValueError("exactly one option must be marked correct")
        return self


class UpdateQuestionResponse(QuestionResponse):
    """PATCH/duplicate/single-question response; identical shape to QuestionResponse."""


class ReorderQuestionsRequest(BaseModel):
    """POST /quizzes/{id}/questions/reorder body (P5-025)."""

    question_ids: list[uuid.UUID] = Field(
        min_length=1, description="Full ordered list of question ids (a permutation)"
    )


__all__ = [
    "CreateQuestionRequest",
    "UpdateQuestionRequest",
    "UpdateQuestionResponse",
    "ReorderQuestionsRequest",
    "QuestionResponse",
    "QuestionOptionResponse",
    "QuizQuestionRequest",
]
