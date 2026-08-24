from pydantic import BaseModel, Field


class ResetPasswordRequest(BaseModel):
    """Payload carried by the link the member received by email."""

    token: str = Field(min_length=16, max_length=255)
    # Field name matches the agreed frontend contract (api.ts).
    password: str = Field(min_length=8, max_length=128)
