"""Generate ``requirements.txt`` from ``pyproject.toml``.

The deployment of the API (the Vercel Python runtime) reads a
requirements file, the project itself declares its dependencies in
``pyproject.toml``. Two hand-written lists drift - that was the finding
(REUSE-007).

So there is one list: the one of ``pyproject.toml``. This script
writes the requirements file from it, and a test in the pipeline
(``tests/unit/test_requirements_in_sync.py``) fails when the file in
the repository is not the one this script produces.

Usage::

    python scripts/sync_requirements.py           # write the file
    python scripts/sync_requirements.py --check   # fail when it drifts
"""

from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PYPROJECT = BACKEND_ROOT / "pyproject.toml"
REQUIREMENTS = BACKEND_ROOT / "requirements.txt"

HEADER = """\
# Runtime dependencies for the Vercel Python deployment.
#
# GENERATED FILE - do not edit it by hand.
# The source of truth is pyproject.toml ([project.dependencies]);
# regenerate with: python scripts/sync_requirements.py
#
# The pins that are not obvious:
#   PyJWT       replaces python-jose (PYSEC-2026-4298); the app only
#               signs and verifies HS256 tokens.
#   certifi     transitive of httpx; the floor is past PYSEC-2026-4320.
#   tzdata      the serverless runtimes ship no OS zoneinfo database;
#               without it ZoneInfo("Africa/Cairo") raises and every
#               attendance route answers 500.
"""


def requirements_from_pyproject(path: Path = PYPROJECT) -> list[str]:
    """The runtime requirements, in the order of the pyproject file."""
    with path.open("rb") as handle:
        pyproject = tomllib.load(handle)

    return list(pyproject["project"]["dependencies"])


def render(requirements: list[str]) -> str:
    """The contents of the requirements file."""
    return HEADER + "\n".join(requirements) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="only report whether the file is in sync (exit code 1 when not)",
    )
    args = parser.parse_args(argv)

    expected = render(requirements_from_pyproject())
    current = REQUIREMENTS.read_text(encoding="utf-8") if REQUIREMENTS.exists() else ""

    if args.check:
        if current != expected:
            print(
                "requirements.txt is not in sync with pyproject.toml - "
                "run: python scripts/sync_requirements.py",
                file=sys.stderr,
            )
            return 1
        print("requirements.txt is in sync with pyproject.toml")
        return 0

    REQUIREMENTS.write_text(expected, encoding="utf-8")
    print(f"wrote {REQUIREMENTS.relative_to(BACKEND_ROOT)}")
    return 0


if __name__ == "__main__":  # pragma: no cover - the entry point
    raise SystemExit(main())
