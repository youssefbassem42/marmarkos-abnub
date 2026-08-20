"""Audit log persistence tests."""

import uuid

from app.modules.admin.infrastructure.persistence.models import AuditLog
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_audit_log_record(uow: UnitOfWork) -> None:
    admin = await make_user(uow, "audit-admin@example.com")
    banned = await make_user(uow, "audit-target@example.com")
    await uow.commit()

    entry = await uow.audit.record(
        action="user.ban",
        entity_type="user",
        entity_id=str(banned.id),
        actor_user_id=admin.id,
        metadata={"reason": "spam", "severity": "high"},
    )
    await uow.commit()

    assert entry.id is not None
    history = await uow.audit.list_for_entity("user", str(banned.id))
    assert len(history) == 1
    assert history[0].action == "user.ban"
    assert history[0].actor_user_id == admin.id
    assert history[0].details == {"reason": "spam", "severity": "high"}


async def test_audit_log_is_append_only(uow: UnitOfWork) -> None:
    for _ in range(3):
        await uow.audit.record(
            action="blog.publish",
            entity_type="blog_post",
            entity_id=str(uuid.uuid4()),
            actor_user_id=None,
        )
    await uow.commit()

    all_logs = (await uow.session.execute(AuditLog.__table__.select())).all()
    assert len(all_logs) == 3
