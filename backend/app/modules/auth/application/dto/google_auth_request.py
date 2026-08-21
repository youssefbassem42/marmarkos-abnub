from pydantic import BaseModel, Field


class GoogleAuthRequest(BaseModel):
    """Google Identity Services ID token obtained by the frontend."""

    credential: str = Field(..., min_length=20)
