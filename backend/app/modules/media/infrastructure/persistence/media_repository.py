import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.domain.enums.media_asset_type import MediaAssetType
from app.modules.media.infrastructure.persistence.models import LandingSlide, MediaAsset


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

    # -- Landing slides ---------------------------------------------------

    async def get_landing_slide(self, slide_id: uuid.UUID) -> LandingSlide | None:
        result = await self._session.execute(
            select(LandingSlide).where(LandingSlide.id == slide_id)
        )
        return result.scalar_one_or_none()

    async def list_landing_slides(self) -> list[LandingSlide]:
        result = await self._session.execute(
            select(LandingSlide).order_by(LandingSlide.order, LandingSlide.created_at)
        )
        return list(result.scalars().all())

    async def list_active_landing_slides(self) -> list[LandingSlide]:
        result = await self._session.execute(
            select(LandingSlide)
            .where(LandingSlide.active.is_(True))
            .order_by(LandingSlide.order, LandingSlide.created_at)
        )
        return list(result.scalars().all())

    async def create_landing_slide(
        self,
        *,
        image: str,
        title: str | None = None,
        subtitle: str | None = None,
        order: int = 0,
    ) -> LandingSlide:
        slide = LandingSlide(
            image=image,
            title=title,
            subtitle=subtitle,
            order=order,
        )
        self._session.add(slide)
        await self._session.flush()
        return slide

    async def update_landing_slide(
        self,
        slide: LandingSlide,
        *,
        image: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        active: bool | None = None,
    ) -> None:
        if image is not None:
            slide.image = image
        if title is not None:
            slide.title = title
        if subtitle is not None:
            slide.subtitle = subtitle
        if active is not None:
            slide.active = active
        await self._session.flush()

    async def delete_landing_slide(self, slide_id: uuid.UUID) -> None:
        await self._session.execute(delete(LandingSlide).where(LandingSlide.id == slide_id))

    async def reorder_landing_slides(self, slide_ids: list[uuid.UUID]) -> None:
        for index, slide_id in enumerate(slide_ids):
            await self._session.execute(
                update(LandingSlide).where(LandingSlide.id == slide_id).values(order=index)
            )
