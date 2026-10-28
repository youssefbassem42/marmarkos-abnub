"""
A DTO must declare every field that its query passes to it.

Pydantic ignores the keys that a model does not declare (the default is
`extra="ignore"`). A query that computes a number and hands it to a
DTO that does not declare it therefore **loses** the number silently:
the answer of the server does not carry it, and the page that reads it
crashes (`undefined.toFixed(1)`) or shows a zero.

This test reads the source of the modules and compares the keywords of
every `SomeDto(...)` call with the fields the DTO declares. It is a
static check on purpose: it finds the mistake **before** the answer
reaches a member.
"""

from __future__ import annotations

import ast
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app"


def _dto_fields() -> dict[str, set[str]]:
    """The fields every DTO (a class of a `dto.py`) declares."""
    fields: dict[str, set[str]] = {}
    for path in APP.rglob("dto*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            names = {
                statement.target.id
                for statement in node.body
                if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name)
            }
            if names:
                fields[node.name] = names
    return fields


def _calls() -> list[tuple[str, str, str, str]]:
    """The (file, line, model, keyword) of every construction of a DTO."""
    calls: list[tuple[str, str, str, str]] = []
    for path in APP.rglob("*.py"):
        if path.name.startswith("dto"):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = node.func.id if isinstance(node.func, ast.Name) else None
            if name is None:
                continue
            for keyword in node.keywords:
                if keyword.arg is None:
                    continue  # **kwargs
                calls.append(
                    (
                        str(path.relative_to(APP)),
                        str(node.lineno),
                        name,
                        keyword.arg,
                    )
                )
    return calls


def test_every_dto_call_only_passes_declared_fields() -> None:
    """No call may hand a DTO a field the DTO does not declare."""
    fields = _dto_fields()
    mistakes: list[str] = []

    for where, line, model, keyword in _calls():
        declared = fields.get(model)
        if declared is None:
            continue
        if keyword not in declared:
            mistakes.append(
                f"{where}:{line} — {model}({keyword}=...) — the DTO does not "
                f"declare '{keyword}' (pydantic drops it silently)"
            )

    assert not mistakes, "\n".join(mistakes)
