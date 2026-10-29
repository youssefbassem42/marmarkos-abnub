"""SQLAlchemy ORM model for landing-page media assets.

Stores metadata + URL only; binary files live in object storage behind
the ``MediaStorage`` abstraction (e.g. Cloudinary/S3).
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class MediaAsset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"
    __table_args__ = (Index("ix_media_assets_section_active", "section", "is_active"),)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[MediaAssetType] = mapped_column(
        SAEnum(MediaAssetType, name="media_asset_type", native_enum=False, length=20),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    section: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by_user: Mapped["User | None"] = relationship()


class LandingSlide(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One slide of the landing-page slider.

    The image is the secure URL returned by the shared media upload
    service (Cloudinary); the binary file itself is never stored here.
    """

    __tablename__ = "landing_slides"
    __table_args__ = (
        Index("ix_landing_slides_active", "active"),
        Index("ix_landing_slides_order", "order"),
    )

    image: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(300))
    order: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0, nullable=False)
    active: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true"), default=True, nullable=False
    )
