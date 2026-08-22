from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Marmarkos ABNUB API"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str

    JWT_SECRET: str
    JWT_REFRESH_SECRET: str

    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None

    # Where the browser is sent back after the Google OAuth redirect flow.
    FRONTEND_URL: str = "http://localhost:5173"

    CORS_ORIGINS: str = "http://localhost:5173"

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_CHAT_ID: str | None = None

    BREVO_API_KEY: str | None = None
    BREVO_SENDER_EMAIL: str | None = None
    BREVO_SENDER_NAME: str = "Marmarkos ABNUB"

    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # -- Attendance (Phase 2) ------------------------------------------------
    # IANA name of the single platform timezone. Every "which meeting is
    # open", "what date is it" and check-in timestamp is computed here.
    PLATFORM_TIMEZONE: str = "Africa/Cairo"
    # Local time the weekly meeting starts; scans later than start +
    # grace are recorded as LATE (BR-2).
    MEETING_START_TIME: str = "19:00"
    # Minutes after MEETING_START_TIME still counted as on-time.
    MEETING_LATE_GRACE_MINUTES: int = 15
    # Local time on the meeting day after which the absent list becomes
    # final (BR-5).
    MEETING_ABSENCE_CUTOFF_TIME: str = "21:00"
    # History pagination defaults (route GET /attendance).
    ATTENDANCE_HISTORY_PAGE_SIZE: int = 20
    ATTENDANCE_HISTORY_MAX_PAGE_SIZE: int = 100

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()  # type: ignore[call-arg]
