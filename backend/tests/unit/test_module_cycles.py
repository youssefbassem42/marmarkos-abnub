"""The module graph of the backend must stay acyclic (ARCH-001).

Two modules that import each other cannot be tested, extracted or
replaced on their own: the import order decides which one works. The
audit proved two such cycles (attendance <-> notifications and
bible <-> quiz); this test is the guard that keeps them from coming
back.

The scan looks at the **module-level** imports only. An import inside a
function is a deliberate, local decision (it exists exactly to avoid a
cycle) and does not make the module graph cyclic.
"""

import ast
from collections.abc import Iterator
from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parents[2] / "app"
MODULES_ROOT = APP_ROOT / "modules"


def _module_name(path: Path) -> str:
    """``app/modules/quiz/...`` -> ``quiz``."""
    relative = path.relative_to(MODULES_ROOT)
    return relative.parts[0]


def _module_level_imports(path: Path) -> set[str]:
    """The modules this file imports at module level.

    Two kinds of import do **not** create a runtime cycle and are left
    out, exactly like the scan of the audit:

    * an import inside a function (a deliberate, local decision),
    * an import under ``if TYPE_CHECKING:`` (the type checker resolves
      it, the interpreter never imports it).
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: set[str] = set()
    for node in tree.body:  # module level only
        if isinstance(node, ast.If):
            # `if TYPE_CHECKING:` - the block is not executed at runtime.
            test = node.test
            is_type_checking = (isinstance(test, ast.Name) and test.id == "TYPE_CHECKING") or (
                isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"
            )
            if is_type_checking:
                continue
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            # A relative import (level > 0) never leaves the module.
            if node.level == 0 and node.module:
                found.add(node.module)
    return found


def _edges() -> dict[str, set[str]]:
    """The module graph: module -> the modules it imports."""
    graph: dict[str, set[str]] = {}
    for path in sorted(MODULES_ROOT.rglob("*.py")):
        if "__pycache__" in path.parts or path.name == "__init__.py":
            continue
        current = _module_name(path)
        targets: set[str] = set()
        for imported in _module_level_imports(path):
            parts = imported.split(".")
            if len(parts) >= 2 and parts[0] == "app" and parts[1] == "modules":
                targets.add(parts[2])
        # A module that imports its own subpackage is not a cycle.
        targets.discard(current)
        graph.setdefault(current, set()).update(targets)
    return graph


def _cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    """Every cycle of the graph (each one listed once, from its smallest member)."""
    cycles: list[list[str]] = []
    seen: set[frozenset[str]] = set()

    def walk(start: str, current: str, path: list[str]) -> None:
        for neighbour in sorted(graph.get(current, ())):
            if neighbour == start:
                cycle = path
                key = frozenset(cycle)
                if key not in seen:
                    seen.add(key)
                    cycles.append(cycle)
                continue
            # A cycle is only reported from its smallest member, so the
            # same circle is not listed twice.
            if neighbour in path or neighbour < start:
                continue
            walk(start, neighbour, [*path, neighbour])

    for module in sorted(graph):
        walk(module, module, [module])
    return cycles


#: The cycles that are still there, with the reason. A **new** cycle
#: fails the build; a cycle that is fixed may stay in the list (the
#: test only checks that nothing was added).
KNOWN_CYCLES: tuple[frozenset[str], ...] = (
    # No cycle is left: the guard of the current member moved to the
    # users module (the owner of the member) in Phase 4.4, and the
    # dependency now flows one way - auth knows users, users does not
    # know auth.
)


def test_the_module_graph_has_no_cycle() -> None:
    """The modules must not import each other in a circle."""
    cycles = _cycles(_edges())

    assert cycles == [], f"import cycles: {cycles}"


@pytest.mark.parametrize(
    ("module", "forbidden"),
    [
        # The shared vocabulary is the only way out of a cycle.
        ("notifications", {"attendance"}),
        ("bible", {"quiz"}),
        # The members own the guard of the current member (Phase 4.4):
        # the users module must not import the auth module.
        ("users", {"auth"}),
    ],
)
def test_a_module_does_not_import_its_former_partner(module: str, forbidden: set[str]) -> None:
    """The cycles of the audit must stay broken."""
    edges = _edges()

    assert not (edges.get(module, set()) & forbidden), (
        f"{module} imports {edges.get(module, set()) & forbidden} at module level"
    )


def test_the_guard_of_the_current_member_has_one_home() -> None:
    """The guard lives in the users module; the old path re-exports it.

    The shim keeps the old import path working (one release), but it
    must be the **same objects**, not copies: a copy would create two
    guards, and the dependency overrides of one would not apply to the
    other.
    """
    from app.modules.auth.presentation.dependencies import get_current_user as old
    from app.modules.auth.presentation.dependencies import require_role as old_role
    from app.modules.users.presentation.dependencies import get_current_user, require_role

    assert old is get_current_user
    assert old_role is require_role


def test_the_shared_contracts_are_the_home_of_the_vocabulary() -> None:
    """The enumerations live in the shared kernel and are re-exported."""
    from app.modules.attendance.domain.enums import AttendanceStatus as ReExported
    from app.modules.quiz.domain.enums import AttemptStatus as ReExportedAttempt
    from app.modules.users.domain.enums import RoleName as ReExportedRole
    from app.shared.contracts import AttemptStatus, AttendanceStatus, RoleName

    # The re-export is the same object, not a copy.
    assert ReExported is AttendanceStatus
    assert ReExportedAttempt is AttemptStatus
    assert ReExportedRole is RoleName


def test_the_read_model_of_the_quizzes_is_reachable_without_the_quiz_module() -> None:
    """The bible module asks for the quizzes through the contract."""
    from app.shared.contracts.quiz_read import QuizReadModel

    assert hasattr(QuizReadModel, "quiz_states_by_verse")
    assert hasattr(QuizReadModel, "viewer_attempts_by_quiz")


def _iter_module_files() -> Iterator[Path]:
    yield from sorted(MODULES_ROOT.rglob("*.py"))
