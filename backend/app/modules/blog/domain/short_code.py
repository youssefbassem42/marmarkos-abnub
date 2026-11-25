"""The tiny, shareable code of a blog post."""

import secrets
import string

_SHORT_CODE_LENGTH = 8
_SHORT_CODE_ALPHABET = string.ascii_letters + string.digits


def generate_short_code() -> str:
    """Return an eight-character URL-safe code made only of letters and digits."""
    return "".join(secrets.choice(_SHORT_CODE_ALPHABET) for _ in range(_SHORT_CODE_LENGTH))
