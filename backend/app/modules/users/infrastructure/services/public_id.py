import secrets
import string

_PUBLIC_ID_ALPHABET = string.ascii_letters + string.digits
_PUBLIC_ID_LENGTH = 12


def generate_public_id() -> str:
    return "USR_" + "".join(secrets.choice(_PUBLIC_ID_ALPHABET) for _ in range(_PUBLIC_ID_LENGTH))
