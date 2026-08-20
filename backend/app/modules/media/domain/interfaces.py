"""Repository interface for media assets."""

import uuid
from typing import Protocol

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.modules.media.infrastructure.persistence.models import MediaAsset


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
