from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Marmarkos ABNUB API"
    APP_ENV: str = "development"
    # Default False: debug mode must be explicitly opted in to.
    # Never rely on the default in a production or staging deployment.
    DEBUG: bool = False
    EXPOSE_ERROR_DETAILS: bool = False

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

    # Display name used in the From: header for all mail transports.
    # When not set explicitly, falls back to BREVO_SENDER_NAME so existing
    # deployments that only set BREVO_SENDER_NAME continue to work unchanged.
    # Set MAIL_SENDER_NAME directly to control the From: name independently
    # of the Brevo sender identity.
    MAIL_SENDER_NAME: str = ""

    @property
    def effective_sender_name(self) -> str:
        """Resolved From: display name — MAIL_SENDER_NAME if non-empty,
        otherwise BREVO_SENDER_NAME (backwards-compatible fallback)."""
        return self.MAIL_SENDER_NAME or self.BREVO_SENDER_NAME

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
    # Dedicated pepper for attendance PIN hashing.  Must be treated like a
    # password — if compromised, all stored PIN hashes must be regenerated.
    # Kept separate from JWT_SECRET so the two can rotate independently:
    # rotating JWT_SECRET (token compromise) must NOT invalidate every
    # member's attendance PIN.
    # When empty the system falls back to a derivative of JWT_SECRET for
    # backwards compatibility, but a dedicated value is strongly preferred.
    ATTENDANCE_PIN_PEPPER: str = ""

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

    # -- Bible verses, quizzes & points (Phase 5) ---
    CRON_SECRET: str | None = None            # shared secret for /internal/scheduler/tick
    SCHEDULER_TICK_MAX_BATCH: int = 50
    VERSE_OPEN_DEDUPE_SECONDS: int = 300      # D-16
    BIBLE_VERSES_PAGE_SIZE: int = 12
    BIBLE_VERSES_MAX_PAGE_SIZE: int = 50
    QUIZ_MIN_DURATION_SECONDS: int = 30
    QUIZ_MAX_DURATION_SECONDS: int = 7200
    QUIZ_MAX_QUESTIONS: int = 50
    QUIZ_MAX_OPTIONS_PER_QUESTION: int = 6
    QUIZ_ATTEMPT_GRACE_SECONDS: int = 5       # network-latency tolerance, BR-26/27
    QUIZ_ANALYTICS_PAGE_SIZE: int = 10
    QUIZ_ANALYTICS_MAX_PAGE_SIZE: int = 100
    POINTS_HISTORY_MAX_MONTHS: int = 24
    ANALYTICS_EXPORT_MAX_ROWS: int = 5000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()  # type: ignore[call-arg]
