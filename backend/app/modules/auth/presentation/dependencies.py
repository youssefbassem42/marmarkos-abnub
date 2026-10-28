"""The guard of the current member — **moved** to the users module.

The guard answers "who is calling?" and returns the member, so it
belongs to the module that owns the member (ARCH-001, Phase 4.4). The
implementation now lives in
:mod:`app.modules.users.presentation.dependencies`.

This file re-exports **the very same objects** (not copies): the
identity of the guard is unchanged, so every caller - inside this
repository and outside it - keeps working. The shim will be removed
one release after the move.
"""

from app.modules.users.presentation.dependencies import (
    SessionDependency,
    get_current_user,
    require_role,
)

__all__ = ["SessionDependency", "get_current_user", "require_role"]
