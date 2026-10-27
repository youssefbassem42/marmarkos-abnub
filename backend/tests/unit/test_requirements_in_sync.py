"""The requirements file is generated (REUSE-007).

``pyproject.toml`` declares the dependencies; ``requirements.txt`` is
what the deployment reads. The second one is written by
``scripts/sync_requirements.py`` - this test fails when the two drift
apart, so nobody has to remember to update both.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_ROOT / "scripts"))

from sync_requirements import (  # noqa: E402
    REQUIREMENTS,
    render,
    requirements_from_pyproject,
)


def test_the_requirements_file_matches_the_pyproject() -> None:
    expected = render(requirements_from_pyproject())

    assert REQUIREMENTS.exists(), "requirements.txt is missing"
    assert REQUIREMENTS.read_text(encoding="utf-8") == expected, (
        "requirements.txt is not in sync with pyproject.toml - "
        "run: python scripts/sync_requirements.py"
    )


def test_the_runtime_dependencies_are_the_ones_of_the_project() -> None:
    requirements = requirements_from_pyproject()

    assert requirements, "the project declares no dependency"
    for requirement in requirements:
        name = requirement.split(";")[0].split("[")[0].split(">")[0].split("=")[0].strip()
        assert name, f"unreadable requirement: {requirement!r}"


def test_the_generator_is_idempotent() -> None:
    once = render(requirements_from_pyproject())
    twice = render(requirements_from_pyproject())

    assert once == twice
