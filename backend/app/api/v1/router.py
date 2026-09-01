from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.modules.anonymous_messages.presentation.router import router as anonymous_messages_router
from app.modules.attendance.presentation.router import router as attendance_router
from app.modules.auth.presentation.router import router as auth_router
from app.modules.bible.presentation.router import router as bible_router
from app.modules.internal.presentation.router import router as internal_router
from app.modules.notifications.presentation.router import router as notifications_router
from app.modules.points.presentation.analytics_router import router as analytics_router
from app.modules.points.presentation.router import router as points_router
from app.modules.quiz.presentation.router import (
    attempt_router as quiz_attempt_router,
)
from app.modules.quiz.presentation.router import (
    question_router as quiz_question_router,
)
from app.modules.quiz.presentation.router import quiz_router
from app.modules.users.presentation.router import router as users_router

router = APIRouter(prefix="/v1")

router.include_router(health_router, tags=["Health"])
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(notifications_router)
router.include_router(attendance_router)
router.include_router(anonymous_messages_router)
router.include_router(bible_router)
router.include_router(quiz_router)
router.include_router(quiz_question_router)
router.include_router(quiz_attempt_router)
router.include_router(points_router)
router.include_router(analytics_router)
router.include_router(internal_router)
