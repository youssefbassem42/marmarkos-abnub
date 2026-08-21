from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=8, max_length=32)
    date_of_birth: date
    address: str = Field(min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def password_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password must not be blank")
        return value

    @field_validator("first_name", "last_name", "address", "phone")
    @classmethod
    def strip_and_require(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @model_validator(mode="after")
    def birth_date_in_the_past(self) -> "RegisterRequest":
        from datetime import date as _date

        if self.date_of_birth >= _date.today():
            raise ValueError("date_of_birth must be in the past")
        return self
