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


def test_the_catalogue_lists_every_identifier_once() -> None:
    """Two statements for one identifier: the reader does not know the rule.

    The wave of the blog found it: two agents wrote their rules from the
    same free identifier, so ``BR-85`` carried two different meanings.
    The catalogue is the reference; an identifier that appears twice is
    a defect that hides behind a passing test.
    """
    # The numbering restarts in every phase (the rule is written down in
    # the header of the catalogue), so the same identifier may live in
    # two sections. It may **never** live twice in the same section: two
    # statements for one identifier leave the reader guessing.
    section = ""
    seen: dict[tuple[str, str], int] = {}
    for line in CATALOGUE.read_text(encoding="utf-8").split("\n"):
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if not line.startswith("| `"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        identifier = cells[0].strip("`")
        key = (section, identifier)
        seen[key] = seen.get(key, 0) + 1

    duplicated = sorted(
        f"{section}/{identifier}" for (section, identifier), count in seen.items() if count > 1
    )

    assert duplicated == [], (
        f"the catalogue lists these identifiers more than once in the same "
        f"section: {duplicated} - a rule has one identifier and one statement"
    )


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
