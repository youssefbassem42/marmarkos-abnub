"""Quiz analytics overview query (P5-057)."""

from sqlalchemy import func, select

from app.modules.quiz.infrastructure.persistence.models import (
    QuizAttempt,
    Quiz,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def quiz_analytics_overview_query(uow: UnitOfWork) -> dict[str, object]:
    """Aggregate quiz stats across all quizzes for the admin dashboard."""
    total_quizzes = int(
        (
            await uow.session.execute(select(func.count(Quiz.id)))
        ).scalar_one()
    )
    published_quizzes = int(
        (
            await uow.session.execute(
                select(func.count(Quiz.id)).where(Quiz.status == "PUBLISHED")
            )
        ).scalar_one()
    )
    from app.modules.quiz.domain.enums import AttemptStatus

    participants = int(
        (
            await uow.session.execute(
                select(func.count(func.distinct(QuizAttempt.user_id)))
            )
        ).scalar_one()
    )
    completed = int(
        (
            await uow.session.execute(
                select(func.count()).where(
                    QuizAttempt.status.in_([
                        AttemptStatus.COMPLETED,
                        AttemptStatus.AUTO_FINISHED,
                    ])
                )
            )
        ).scalar_one()
    )
    auto_finished = int(
        (
            await uow.session.execute(
                select(func.count()).where(
                    QuizAttempt.status == AttemptStatus.AUTO_FINISHED
                )
            )
        ).scalar_one()
    )
    avg_score = float(
        (
            await uow.session.execute(
                select(func.avg(QuizAttempt.score))
            )
        ).scalar_one()
        or 0
    )
    return {
        "total_quizzes": total_quizzes,
        "published_quizzes": published_quizzes,
        "participants": participants,
        "completed": completed,
        "auto_finished": auto_finished,
        "average_score": round(avg_score, 1),
    }
