"""A tiny in-process counter registry (Prometheus exposition format).

The counters live in the memory of the process, which is enough for the
questions the operations actually ask: "did the outbox start failing?",
"how many sign-ins are being rate limited?", "is the scheduler still
publishing?". They are reset when the process restarts - the durable
counters (the pending outbox rows) are read from the database by the
metrics endpoint itself.

No third-party dependency: the registry is a dict of counters and the
exposition format is a few lines of string building.
"""

import threading
from collections import defaultdict
from collections.abc import Iterable

_LOCK = threading.Lock()
_COUNTERS: dict[str, dict[tuple[tuple[str, str], ...], float]] = defaultdict(dict)


def increment(name: str, labels: dict[str, str] | None = None, value: float = 1.0) -> None:
    """Add ``value`` to the counter ``name`` with the given labels."""
    key = tuple(sorted((labels or {}).items()))
    with _LOCK:
        _COUNTERS[name][key] = _COUNTERS[name].get(key, 0.0) + value


def counter_value(name: str, labels: dict[str, str] | None = None) -> float:
    """The current value of one counter (0 when it was never touched)."""
    key = tuple(sorted((labels or {}).items()))
    with _LOCK:
        return _COUNTERS.get(name, {}).get(key, 0.0)


def snapshot() -> dict[str, dict[tuple[tuple[str, str], ...], float]]:
    """A copy of every counter."""
    with _LOCK:
        return {name: dict(values) for name, values in _COUNTERS.items()}


def reset() -> None:
    """Drop every counter (used by the test suite)."""
    with _LOCK:
        _COUNTERS.clear()


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def render(extra: Iterable[tuple[str, float]] = ()) -> str:
    """The Prometheus exposition format of every counter.

    ``extra`` carries the gauges that are read from the database (for
    example the number of pending outbox rows).
    """
    lines: list[str] = []
    data = snapshot()
    for name in sorted(data):
        lines.append(f"# TYPE {name} counter")
        for key, value in sorted(data[name].items()):
            labels = ",".join(f'{k}="{_escape(v)}"' for k, v in key)
            suffix = f"{{{labels}}}" if labels else ""
            lines.append(f"{name}{suffix} {value:g}")
    for name, value in extra:
        lines.append(f"# TYPE {name} gauge")
        lines.append(f"{name} {value:g}")
    return "\n".join(lines) + "\n"
