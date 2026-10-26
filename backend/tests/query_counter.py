"""Count the SQL statements a request issues (N+1 guards).

The counter is a SQLAlchemy event listener on the sync engine behind the
async session factory: every statement that reaches the database is
counted, whatever issued it.
"""

from __future__ import annotations

import contextlib
import typing
from collections.abc import AsyncIterator, Callable

from sqlalchemy import event

from app.core.database import async_session_factory

if typing.TYPE_CHECKING:
    pass

_query_count: list[int] = [0]


def _before_cursor_execute(conn, cursor, stmt, params, context, executemany):  # noqa: ANN001
    _query_count[0] += 1


@contextlib.asynccontextmanager
async def count_queries() -> AsyncIterator[Callable[[], int]]:
    """Count the statements issued inside the block.

    Usage::

        async with count_queries() as get_count:
            response = await client.get(...)
        assert get_count() <= 6
    """
    sync_engine = async_session_factory.kw["bind"].sync_engine
    event.listen(sync_engine, "before_cursor_execute", _before_cursor_execute)
    _query_count[0] = 0
    try:
        yield lambda: _query_count[0]
    finally:
        try:
            event.remove(sync_engine, "before_cursor_execute", _before_cursor_execute)
        except ValueError:
            pass


def reset_query_count() -> None:
    """Forget the statements counted so far."""
    _query_count[0] = 0
