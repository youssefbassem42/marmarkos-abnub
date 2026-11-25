"""The points earned by publishing a blog post (BR-85)."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.core.time.clock import to_local
from app.core.time.periods import iso_week_start, month_start
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

BLOG_POST_PUBLICATION_POINTS = 3


async def award_blog_post_publication_points(
    uow: UnitOfWork,
    *,
    user_id: uuid.UUID,
    blog_post_id: uuid.UUID,
    awarded_at: datetime,
) -> bool:
    """Award the publication points once, in the caller's transaction.

    The ledger's unique ``blog_post_id`` index is the idempotency guard.
    The helper never commits: a failed award therefore rolls back the
    publication that called it.
    """
    local_day = to_local(awarded_at).date()
    _row, inserted = await uow.point_transactions.award(
        user_id=user_id,
        blog_post_id=blog_post_id,
        points=BLOG_POST_PUBLICATION_POINTS,
        period_week_start=iso_week_start(local_day),
        period_month=month_start(local_day),
        awarded_at=awarded_at,
    )
    return inserted
