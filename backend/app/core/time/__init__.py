"""Platform time helpers.

The only place in the codebase allowed to call ``date.today()`` /
``datetime.now()`` is :mod:`app.core.time.clock`.
"""

from app.core.time.clock import (
    local_datetime,
    now_local,
    now_utc,
    platform_timezone,
    to_local,
    today_local,
)
from app.core.time.periods import (
    iso_week_end,
    iso_week_start,
    last_n_months,
    month_bounds,
    month_start,
    month_window_utc,
    week_window_utc,
)

__all__ = [
    "iso_week_end",
    "iso_week_start",
    "last_n_months",
    "local_datetime",
    "month_bounds",
    "month_start",
    "month_window_utc",
    "now_local",
    "now_utc",
    "platform_timezone",
    "today_local",
    "to_local",
    "week_window_utc",
]
