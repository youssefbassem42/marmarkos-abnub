"""The Unit of Work has one documented lifecycle (Phase 4.5, ARCH-004).

Two ways to get a unit of work exist and only two:

* ``UnitOfWork.create(factory)`` - it owns the session,
* ``UnitOfWork.from_session(session)`` - the session belongs to somebody
  else.

The direct construction is deprecated for one release: it still works,
but it warns.
"""

from __future__ import annotations

import inspect
import warnings
from typing import Any

import pytest
from fastapi.routing import APIRoute

from app.core.database import get_db_session, get_unit_of_work
from app.main import app
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class _FakeSession:
    """The smallest object the unit of work accepts."""

    def __init__(self) -> None:
        self.committed = False
        self.rolled_back = False

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True


def test_from_session_keeps_the_session_and_starts_empty() -> None:
    session = _FakeSession()

    uow = UnitOfWork.from_session(session)  # type: ignore[arg-type]

    assert uow.session is session
    assert uow._events == []
    assert uow._committed is False


def test_the_direct_construction_warns_but_still_works() -> None:
    session = _FakeSession()

    with pytest.warns(DeprecationWarning, match="UnitOfWork.from_session"):
        uow = UnitOfWork(session)  # type: ignore[arg-type]

    assert uow.session is session


def test_the_warning_names_the_two_replacements() -> None:
    session = _FakeSession()

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        UnitOfWork(session)  # type: ignore[arg-type]

    assert len(caught) == 1
    message = str(caught[0].message)
    assert "from_session" in message
    assert "create(session_factory)" in message


def _dependency_calls(route: APIRoute) -> set[Any]:
    """Every dependency callable of a route, at any depth."""
    found: set[Any] = set()

    def walk(dependant: Any) -> None:
        for dependency in dependant.dependencies:
            found.add(dependency.call)
            walk(dependency)

    walk(route.dependant)
    return found


def test_no_route_asks_for_two_sessions_at_once() -> None:
    """A route must not mix the session dependency and the unit of work.

    ``get_db_session`` and ``get_unit_of_work`` each open a session of
    their own: a route that depends on both would work on two
    connections and would not see its own uncommitted writes in the
    other one.
    """
    offenders: list[str] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        calls = _dependency_calls(route)
        if get_db_session in calls and get_unit_of_work in calls:
            offenders.append(f"{route.path} [{', '.join(sorted(route.methods or []))}]")

    assert offenders == [], f"routes with two sessions: {offenders}"


def test_the_two_dependencies_are_two_different_lifetimes() -> None:
    """The guard above is only useful if the two really differ."""
    assert get_db_session is not get_unit_of_work
    assert inspect.isasyncgenfunction(get_db_session)
    assert inspect.isasyncgenfunction(get_unit_of_work)
    # ``create`` is an async context manager around an async generator.
    assert inspect.isasyncgenfunction(UnitOfWork.create.__func__.__wrapped__)  # type: ignore[attr-defined]
