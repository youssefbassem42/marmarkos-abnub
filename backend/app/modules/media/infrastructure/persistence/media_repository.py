import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.modules.media.infrastructure.persistence.models import MediaAsset


class MediaRepository:
    """Landing-page media metadata. Binary storage stays behind MediaStorage."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, asset: MediaAsset) -> None:
        self._session.add(asset)
        await self._session.flush()

    async def get_by_id(self, asset_id: uuid.UUID) -> MediaAsset | None:
        result = await self._session.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
        return result.scalar_one_or_none()

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
    ) -> MediaAsset:
        asset = MediaAsset(
            name=name,
            type=type,
            url=url,
            section=section,
            alt_text=alt_text,
            sort_order=sort_order,
            created_by=created_by,
        )
        self._session.add(asset)
        await self._session.flush()
        return asset

    async def list_active(self, section: str | None = None) -> list[MediaAsset]:
        stmt = select(MediaAsset).where(MediaAsset.is_active.is_(True))
        if section is not None:
            stmt = stmt.where(MediaAsset.section == section)
        stmt = stmt.order_by(MediaAsset.sort_order, MediaAsset.created_at)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def set_active(self, asset: MediaAsset, is_active: bool) -> None:
        asset.is_active = is_active
        await self._session.flush()
