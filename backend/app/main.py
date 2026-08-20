from fastapi import FastAPI

from app.api.router import api_router
from app.config import settings


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.include_router(api_router)

    return application


app = create_app()
