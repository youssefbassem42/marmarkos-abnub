from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator


class UpdateProfileRequest(BaseModel):
    """Editable profile fields. Email is not changeable (account identity)."""

    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, min_length=8, max_length=32)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("first_name", "last_name", "address", "phone")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def birth_date_in_the_past(self) -> "UpdateProfileRequest":
        from datetime import date as _date

        if self.date_of_birth is not None and self.date_of_birth >= _date.today():
            raise ValueError("date_of_birth must be in the past")
        return self


class ChangePasswordRequest(BaseModel):
    """`current_password` is required only when the account has one already."""

    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
