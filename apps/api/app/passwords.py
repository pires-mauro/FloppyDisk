import base64
import binascii
import hashlib
import hmac
import secrets


_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_KEY_LENGTH = 32


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_KEY_LENGTH,
        maxmem=64 * 1024 * 1024,
    )
    encode = lambda value: base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
    return (
        f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}"
        f"${encode(salt)}${encode(derived_key)}"
    )


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        algorithm, n, r, p, salt_text, key_text = password_hash.split("$")
        if (
            algorithm != "scrypt"
            or (int(n), int(r), int(p))
            != (_SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
        ):
            return False
        decode = lambda value: base64.urlsafe_b64decode(
            value + "=" * (-len(value) % 4)
        )
        salt = decode(salt_text)
        expected_key = decode(key_text)
        if len(salt) != 16 or len(expected_key) != _KEY_LENGTH:
            return False
        actual_key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=_SCRYPT_N,
            r=_SCRYPT_R,
            p=_SCRYPT_P,
            dklen=_KEY_LENGTH,
            maxmem=64 * 1024 * 1024,
        )
    except (ValueError, binascii.Error):
        return False

    return hmac.compare_digest(actual_key, expected_key)
