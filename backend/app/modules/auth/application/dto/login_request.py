from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    #: The member asked to stay signed in after the window is closed. The
    #: refresh cookie then lives 30 days; without it the cookie is a
    #: **session cookie** and dies with the browser (the default: the
    #: session ends when the window is closed).
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()
