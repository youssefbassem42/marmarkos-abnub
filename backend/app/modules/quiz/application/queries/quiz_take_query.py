"""The take path of a quiz: what a member may see while answering.

The manager detail (``GET /quizzes/{id}``) carries the correctness of
every option - a manager has to see it. A member must never see it: the
answers live in the database and the client would carry them to the
browser.

The E2E of Phase 5.5 found the gap: the page of the attempt asked the
manager endpoint and every member received a 403 - **a member could not
answer a quiz at all**. This query is the member path: the questions and
the options, never the correctness.
"""

from __future__ import annotations

import uuid

from app.core.exceptions import NotFoundError
from app.modules.quiz.application.dto.attempt_dto import (
    QuizTakeResponse,
    TakeOptionItem,
    TakeQuestionItem,
)
from app.modules.quiz.domain.enums import QuizStatus
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def quiz_take_query(uow: UnitOfWork, viewer: User, quiz_id: uuid.UUID) -> QuizTakeResponse:
    """The quiz as a member may see it: no correctness, own state only."""
    quiz = await uow.quizzes.get_with_questions(quiz_id)
    if quiz is None or quiz.status != QuizStatus.PUBLISHED:
        # A draft or an archived quiz is not visible to a member; the
        # answer is the same as for a quiz that does not exist.
        raise NotFoundError("Quiz not found")

    # The own attempt (for the "resume" state of the questions).
    attempt = await uow.quiz_attempts.get_for_user_and_quiz(quiz.id, viewer.id)
    selected: dict[uuid.UUID, uuid.UUID | None] = {}
    if attempt is not None:
        answers = await uow.quiz_answers.list_for_attempt(attempt.id)
        selected = {answer.question_id: answer.selected_option_id for answer in answers}
    questions = [
        TakeQuestionItem(
            id=question.id,
            question=question.question,
            points=question.points,
            position=question.position,
            answered=question.id in selected,
            selected_option_id=selected.get(question.id),
            options=[
                TakeOptionItem(
                    id=option.id,
                    option_text=option.option_text,
                    position=option.position,
                )
                for option in sorted(question.options, key=lambda o: o.position)
            ],
        )
        for question in sorted(quiz.questions, key=lambda q: q.position)
    ]

    return QuizTakeResponse(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        duration_seconds=quiz.duration_seconds,
        total_points=quiz.total_points,
        question_count=len(questions),
        attempt_id=attempt.id if attempt is not None else None,
        questions=questions,
    )
