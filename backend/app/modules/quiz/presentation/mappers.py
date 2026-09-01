"""Mapping helpers for quiz API responses (P5-023)."""

from app.modules.quiz.application.dto.quiz_dto import (
    QuestionOptionResponse,
    QuestionResponse,
)
from app.modules.quiz.infrastructure.persistence.models import (
    QuizOption,
    QuizQuestion,
)


def question_to_response(question: QuizQuestion) -> QuestionResponse:
    return QuestionResponse(
        id=question.id,
        question=question.question,
        points=question.points,
        position=question.position,
        options=[
            QuestionOptionResponse(
                id=opt.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                position=opt.position,
            )
            for opt in sorted(question.options, key=lambda o: o.position)
        ],
    )
