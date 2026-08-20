"""Repository interface for the audit log."""

import uuid
from typing import Any, Protocol

from app.modules.admin.infrastructure.persistence.models import AuditLog


class AuditLogRepository(Protocol):
    async def record(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        actor_user_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog: ...

    async def list_for_entity(self, entity_type: str, entity_id: str) -> list[AuditLog]: ...
