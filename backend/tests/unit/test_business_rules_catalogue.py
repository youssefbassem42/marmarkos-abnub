"""The rule identifiers of the code resolve to the catalogue (REUSE-005).

The docstrings cite the business rules (``BR-9``), the decisions
(``D-13``) and the phase-5 tasks (``P5-031``). A reader has to be able
to find out what they mean - and a rule that only lives in the head of
the author is not a rule, it is a rumour.

``docs/business-rules.md`` is the catalogue. This test fails when the
code cites an identifier that is not listed there.
"""

from __future__ import annotations

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_ROOT.parent
APP_ROOT = BACKEND_ROOT / "app"
CATALOGUE = REPO_ROOT / "docs" / "business-rules.md"

IDENTIFIER = re.compile(r"\b(BR-\d+|D-\d+|P5-\d+|DR-\d+)\b")


def _cited_identifiers() -> set[str]:
    """Every rule identifier the production code cites."""
    found: set[str] = set()
    for path in APP_ROOT.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        found.update(IDENTIFIER.findall(path.read_text(encoding="utf-8")))
    return found


def _catalogued_identifiers() -> set[str]:
    """Every identifier the catalogue lists."""
    return set(IDENTIFIER.findall(CATALOGUE.read_text(encoding="utf-8")))


def test_the_catalogue_exists() -> None:
    assert CATALOGUE.exists(), "docs/business-rules.md is missing"


def test_every_cited_identifier_is_in_the_catalogue() -> None:
    cited = _cited_identifiers()
    catalogued = _catalogued_identifiers()
    missing = sorted(cited - catalogued)

    assert missing == [], (
        "the code cites rule identifiers that the catalogue does not explain: "
        f"{missing} - add them to docs/business-rules.md"
    )


def test_the_catalogue_explains_every_identifier_it_lists() -> None:
    """An entry without a statement is a number without a rule."""
    missing: list[str] = []
    for line in CATALOGUE.read_text(encoding="utf-8").split("\n"):
        if not line.startswith("| `"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        identifier, _, statement = cells[0], cells[1], cells[2]
        if not statement or statement in {"The rule", "—"}:
            missing.append(identifier)

    assert missing == [], f"catalogue entries without a statement: {missing}"


def test_the_catalogue_names_the_module_of_every_rule() -> None:
    """The numbering restarts per phase: the module is the second key."""
    catalogue = CATALOGUE.read_text(encoding="utf-8")
    for heading in (
        "## Attendance",
        "## Notifications",
        "## Bible",
        "## Quiz",
        "## Points",
        "## Anonymous messages",
        "## Core and shared kernel",
    ):
        assert heading in catalogue, f"the catalogue misses the section {heading!r}"
