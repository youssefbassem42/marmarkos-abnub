"""Repository interface for media assets."""

import uuid
from typing import Protocol

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.modules.media.infrastructure.persistence.models import LandingSlide, MediaAsset


class MediaRepository(Protocol):
    async def add(self, asset: MediaAsset) -> None: ...

    async def get_by_id(self, asset_id: uuid.UUID) -> MediaAsset | None: ...

    async def list_active(self, section: str | None = None) -> list[MediaAsset]: ...

    async def set_active(self, asset: MediaAsset, is_active: bool) -> None: ...

    async def create(
        self,
        *,
        name: str,
        type: MediaAssetType,
        url: str,
        section: str,
        alt_text: str | None = None,
        sort_order: int = 0,
        created_by: uuid.UUID | None = None,
    ) -> MediaAsset: ...

    # -- Landing slides ---------------------------------------------------

    async def get_landing_slide(self, slide_id: uuid.UUID) -> LandingSlide | None: ...

    async def list_landing_slides(self) -> list[LandingSlide]: ...

    async def list_active_landing_slides(self) -> list[LandingSlide]: ...

    async def create_landing_slide(
        self,
        *,
        image: str,
        title: str | None = None,
        subtitle: str | None = None,
        order: int = 0,
    ) -> LandingSlide: ...

    async def update_landing_slide(
        self,
        slide: LandingSlide,
        *,
        image: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        active: bool | None = None,
    ) -> None: ...

    async def delete_landing_slide(self, slide_id: uuid.UUID) -> None: ...

    async def reorder_landing_slides(self, slide_ids: list[uuid.UUID]) -> None: ...
