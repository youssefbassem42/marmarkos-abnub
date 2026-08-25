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

    # Mail service component: "auto" picks gmail/brevo from credentials,
    # "console" only logs (development).
    MAIL_PROVIDER: str = "auto"
    BREVO_API_KEY: str | None = None
    BREVO_SENDER_EMAIL: str | None = None
    BREVO_SENDER_NAME: str = "Marmarkos ABNUB"

    # Gmail SMTP transport (app password; the address mails are sent from).
    GMAIL_EMAIL: str | None = None
    GMAIL_APP_PASSWORD: str | None = None

    # -- Account verification & password recovery -----------------------------
    # Lifespan of single-use links sent by the mail service component.
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60

    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # -- Attendance (Phase 2) ------------------------------------------------
    # IANA name of the single platform timezone. Every "which meeting is
    # open", "what date is it" and check-in timestamp is computed here.
    PLATFORM_TIMEZONE: str = "Africa/Cairo"
    # Local time the weekly meeting starts; scans later than start +
    # grace are recorded as LATE (BR-2).
    MEETING_START_TIME: str = "18:00"
    # Minutes after MEETING_START_TIME still counted as on-time.
    MEETING_LATE_GRACE_MINUTES: int = 15
    # Local time on the meeting day after which the absent list becomes
    # final (BR-5).
    MEETING_ABSENCE_CUTOFF_TIME: str = "21:00"
    # History pagination defaults (route GET /attendance).
    ATTENDANCE_HISTORY_PAGE_SIZE: int = 20
    ATTENDANCE_HISTORY_MAX_PAGE_SIZE: int = 100

    # -- Notifications & anonymous messages (Phase 4) ------------------------
    # Feed pagination (route GET /notifications).
    NOTIFICATIONS_PAGE_SIZE: int = 20
    NOTIFICATIONS_MAX_PAGE_SIZE: int = 100
    # Simultaneous inline sends during a broadcast email fan-out (BR-8).
    NOTIFICATION_EMAIL_CONCURRENCY: int = 10
    # Anonymous message bounds (BR-16).
    ANONYMOUS_MESSAGE_MIN_LENGTH: int = 10
    ANONYMOUS_MESSAGE_MAX_LENGTH: int = 1000
    # Rate limits (BR-15, D-22): in-memory sliding windows, per instance.
    ANONYMOUS_MESSAGE_RATE_LIMIT_PER_IP: int = 5  # per hour
    ANONYMOUS_MESSAGE_RATE_LIMIT_PER_USER: int = 10  # per day
    # Telegram delivery of anonymous messages (D-20): one chat, forward only.
    TELEGRAM_TIMEOUT_SECONDS: float = 15.0
    TELEGRAM_SEND_ATTEMPTS: int = 2  # inline attempts within one request
    # Read X-Forwarded-For first hop as the client IP (behind a reverse proxy).
    TRUST_PROXY_HEADERS: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()  # type: ignore[call-arg]
