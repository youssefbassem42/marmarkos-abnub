"""The children of a member are deleted by the database, as the schema says.

Every foreign key to ``users.id`` that says ``ondelete="CASCADE"`` is
deleted by PostgreSQL when the member is deleted. SQLAlchemy, however,
nullifies the foreign key of the children it knows about before it
deletes the parent - and those columns are **NOT NULL**: the delete
raised an IntegrityError and the caller saw a 500.

The E2E of Phase 5.5 found it twice: the refresh tokens of a member, and
then the attendance records of the same member.

The relationship must therefore say ``passive_deletes=True``. This test
is the guard: it reads the models, finds every child whose foreign key
cascades, and fails when the relationship of the member does not hand
the work to the database. A new model that cascades gets the same
protection - the test tells the author what to do.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from sqlalchemy import ForeignKey, inspect

from app.modules.users.infrastructure.persistence.models import User

APP_ROOT = Path(__file__).resolve().parents[2] / "app"


def _children_that_cascade() -> list[tuple[str, str]]:
    """Every (class, column) whose foreign key to users.id cascades."""
    found: list[tuple[str, str]] = []
    pattern = re.compile(
        r"class (?P<cls>\w+)\(.*?\):"
        r"|(?P<col>\w+): Mapped\[[^\]]+\] = mapped_column\(\s*"
        r'ForeignKey\("users\.id", ondelete="CASCADE"\)',
        re.DOTALL,
    )
    for path in sorted(APP_ROOT.rglob("*.py")):
        if "__pycache__" in str(path):
            continue
        text = path.read_text(encoding="utf-8")
        current: str | None = None
        for match in pattern.finditer(text):
            if match.group("cls"):
                current = match.group("cls")
                continue
            if current:
                found.append((current, match.group("col")))
    return found


def test_the_cascade_children_are_found() -> None:
    """The scan works: the known children are found."""
    children = _children_that_cascade()

    names = {name for name, _ in children}
    assert "RefreshToken" in names
    assert "WeeklyAttendanceRecord" in names
    assert "QuizAttempt" in names


@pytest.mark.parametrize(
    ("child_class", "column"),
    _children_that_cascade(),
    ids=lambda value: value if isinstance(value, str) else "",
)
def test_the_relationship_of_the_member_hands_the_cascade_to_the_database(
    child_class: str, column: str
) -> None:
    """The relationship of the member must not nullify the foreign key.

    Three behaviours are safe for a child whose foreign key cascades:

    * the relationship says ``passive_deletes=True`` - the database
      deletes the row;
    * the relationship says ``cascade="all, delete-orphan"`` - the ORM
      deletes the row itself;
    * there is no relationship at all - the ORM never touches the row.

    Everything else nullifies the foreign key of a NOT NULL column: the
    delete of the member raises an IntegrityError.
    """
    mapper = inspect(User)
    relationship = None
    for candidate in mapper.relationships:
        if candidate.mapper.class_.__name__ != child_class:
            continue
        relationship = candidate
        break

    if relationship is None:
        # No relationship: the ORM does not know the child and leaves it
        # to the database. Safe.
        return

    if relationship.passive_deletes:
        return

    if "delete" in (relationship.cascade or {}):
        return

    raise AssertionError(
        f"the relationship User.{relationship.key} -> {child_class} must say "
        f"passive_deletes=True (or delete the rows itself): the database "
        f'deletes {child_class}.{column} (ondelete="CASCADE"), the ORM '
        f"must not nullify it - the column is NOT NULL"
    )


def test_no_child_of_the_member_nullifies_its_foreign_key() -> None:
    """No relationship of the member nullifies a NOT NULL foreign key."""
    mapper = inspect(User)
    offenders: list[str] = []

    for relationship in mapper.relationships:
        for column in relationship.mapper.columns:
            if not column.foreign_keys:
                continue
            for foreign_key in column.foreign_keys:
                if foreign_key.ondelete != "CASCADE":
                    continue
                if column.nullable:
                    continue
                if relationship.passive_deletes:
                    continue
                if "delete" in (relationship.cascade or {}):
                    continue
                offenders.append(
                    f"User.{relationship.key} -> "
                    f"{relationship.mapper.class_.__name__}.{column.name}"
                )

    assert not offenders, (
        "these relationships nullify a NOT NULL foreign key that the "
        "database cascades: " + ", ".join(sorted(offenders))
    )


def test_the_foreign_keys_are_really_cascades() -> None:
    """The guard reads the schema, not a hard-coded list."""
    mapper = inspect(User)
    cascades = 0
    for relationship in mapper.relationships:
        for column in relationship.mapper.columns:
            for foreign_key in column.foreign_keys:
                if foreign_key.ondelete == "CASCADE":
                    cascades += 1
                    assert isinstance(foreign_key, ForeignKey)
    assert cascades >= 8, f"only {cascades} cascading children were found"
