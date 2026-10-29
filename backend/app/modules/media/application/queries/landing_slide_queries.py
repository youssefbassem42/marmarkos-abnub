"""Landing-slide query use cases: the public slider and the admin list (plan §7.2)."""

import uuid

from app.core.pagination import Page, PageParams
from app.modules.media.application.dto.landing_slide_dto import (
    LandingSlideAdminItem,
    LandingSlidePublicItem,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def list_public_landing_slides(
    uow: UnitOfWork, page: PageParams
) -> Page[LandingSlidePublicItem]:
    """The active slides, in order — the public fields only."""
    slides = await uow.media.list_active_landing_slides()
    items = [
        LandingSlidePublicItem(
            id=slide.id,
            image=slide.image,
            title=slide.title,
            subtitle=slide.subtitle,
            order=slide.order,
        )
        for slide in slides
    ]
    return Page.build(items, len(items), page)


async def list_admin_landing_slides(
    uow: UnitOfWork, page: PageParams
) -> Page[LandingSlideAdminItem]:
    """Every slide (the inactive ones too) for the administration."""
    slides = await uow.media.list_landing_slides()
    items = [
        LandingSlideAdminItem(
            id=slide.id,
            image=slide.image,
            title=slide.title,
            subtitle=slide.subtitle,
            order=slide.order,
            active=slide.active,
            created_at=slide.created_at,
            updated_at=slide.updated_at,
        )
        for slide in slides
    ]
    return Page.build(items, len(items), page)


async def get_landing_slide_admin_item(
    uow: UnitOfWork, slide_id: uuid.UUID
) -> LandingSlideAdminItem | None:
    """One slide as the admin sees it; ``None`` when it does not exist.

    Used after a commit so the returned timestamps are read fresh instead of
    being lazily reloaded on a session whose transaction is already closed.
    """
    slide = await uow.media.get_landing_slide(slide_id)
    if slide is None:
        return None
    return LandingSlideAdminItem(
        id=slide.id,
        image=slide.image,
        title=slide.title,
        subtitle=slide.subtitle,
        order=slide.order,
        active=slide.active,
        created_at=slide.created_at,
        updated_at=slide.updated_at,
    )
