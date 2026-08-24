from pydantic import BaseModel, Field


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=16, max_length=255)
