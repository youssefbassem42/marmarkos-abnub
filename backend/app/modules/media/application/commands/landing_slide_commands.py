"""Landing-slide command use cases: create, update, delete, reorder (plan §7.2)."""

import uuid

from sqlalchemy import func, select

from app.core.exceptions import NotFoundError
from app.modules.media.application.dto.landing_slide_dto import (
    LandingSlideCreateRequest,
    LandingSlideUpdateRequest,
)
from app.modules.media.infrastructure.persistence.models import LandingSlide
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def create_landing_slide(uow: UnitOfWork, payload: LandingSlideCreateRequest) -> LandingSlide:
    """Append a new slide at the end of the current order."""
    max_order = (await uow.session.execute(select(func.max(LandingSlide.order)))).scalar_one()
    next_order = (max_order or 0) + 1
    slide = await uow.media.create_landing_slide(
        image=payload.image,
        title=payload.title,
        subtitle=payload.subtitle,
        order=next_order,
    )
    await uow.commit()
    return slide


async def update_landing_slide(
    uow: UnitOfWork, slide_id: uuid.UUID, payload: LandingSlideUpdateRequest
) -> LandingSlide:
    slide = await uow.media.get_landing_slide(slide_id)
    if slide is None:
        raise NotFoundError("Slide not found")
    await uow.media.update_landing_slide(
        slide,
        image=payload.image,
        title=payload.title,
        subtitle=payload.subtitle,
        active=payload.active,
    )
    await uow.commit()
    return slide


async def delete_landing_slide(uow: UnitOfWork, slide_id: uuid.UUID) -> None:
    slide = await uow.media.get_landing_slide(slide_id)
    if slide is None:
        raise NotFoundError("Slide not found")
    await uow.media.delete_landing_slide(slide_id)
    await uow.commit()


async def reorder_landing_slides(uow: UnitOfWork, slide_ids: list[uuid.UUID]) -> None:
    """Persist the ids as the new display order (index = order)."""
    await uow.media.reorder_landing_slides(slide_ids)
    await uow.commit()
