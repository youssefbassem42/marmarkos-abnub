import io

import segno


class QRService:
    """Generates QR codes as SVG, encoding a non-sensitive opaque payload.

    segno writes UTF-8-encoded bytes to file-like streams, so a BytesIO
    buffer is used and decoded to text.
    """

    def __init__(self, scale: int = 8, border: int = 2, error: str = "m") -> None:
        self._scale = scale
        self._border = border
        self._error = error

    def generate_svg(self, payload: str) -> str:
        qr = segno.make_qr(payload, error=self._error)
        buffer = io.BytesIO()
        qr.save(buffer, kind="svg", scale=self._scale, border=self._border)
        return buffer.getvalue().decode("utf-8")
