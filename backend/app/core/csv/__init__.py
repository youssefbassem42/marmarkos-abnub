"""CSV streaming helper with UTF-8 BOM for Excel/Arabic (P5-036, BR-40)."""

import csv
import io
from collections.abc import Sequence

from fastapi.responses import StreamingResponse

# UTF-8 BOM — ensures Excel opens the file as UTF-8 (Arabic names intact)
_BOM = "\ufeff"


def stream_csv(
    rows: Sequence[Sequence[object]],
    header: Sequence[str],
    filename: str,
) -> StreamingResponse:
    """Return a ``StreamingResponse`` with ``text/csv; charset=utf-8``.

    * ``header`` — column headers (Arabic labels).
    * ``rows`` — data rows in the same column order.
    * ``filename`` — ``Content-Disposition`` filename.
    """
    buf = io.StringIO()
    buf.write(_BOM)
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
