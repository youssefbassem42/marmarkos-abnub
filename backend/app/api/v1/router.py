from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.modules.attendance.presentation.router import router as attendance_router
from app.modules.auth.presentation.router import router as auth_router
from app.modules.users.presentation.router import router as users_router

router = APIRouter(prefix="/v1")

router.include_router(health_router, tags=["Health"])
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(attendance_router)
