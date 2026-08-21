"""Single import point that registers every ORM model on ``Base.metadata``.

Used by Alembic (``alembic/env.py``) and test infrastructure so the
metadata is always complete, without scattering imports across files.
"""

import app.modules.admin.infrastructure.persistence.models  # noqa: F401
import app.modules.anonymous_messages.infrastructure.persistence.models  # noqa: F401
import app.modules.attendance.infrastructure.persistence.models  # noqa: F401
import app.modules.attendance.infrastructure.persistence.weekly_models  # noqa: F401
import app.modules.auth.infrastructure.persistence.models  # noqa: F401
import app.modules.bible.infrastructure.persistence.models  # noqa: F401
import app.modules.blog.infrastructure.persistence.models  # noqa: F401
import app.modules.comments.infrastructure.persistence.models  # noqa: F401
import app.modules.media.infrastructure.persistence.models  # noqa: F401
import app.modules.notifications.infrastructure.persistence.models  # noqa: F401
import app.modules.users.infrastructure.persistence.models  # noqa: F401
from app.shared.infrastructure.persistence.base import Base
from app.shared.infrastructure.persistence.outbox import OutboxEvent  # noqa: F401

__all__ = ["Base"]
