import hashlib
import hmac
import secrets
import time

from onboarding_shared.screening import ScreeningRequest


# Only this API process issues and validates callback credentials. The scoring
# service gets a short-lived credential tied to the exact screening request.
_KEY = secrets.token_bytes(32)


def _signature(request: ScreeningRequest, expires: int) -> str:
    payload = f'{expires}:{request.model_dump_json()}'.encode()
    return hmac.new(_KEY, payload, hashlib.sha256).hexdigest()


def issue_token(request: ScreeningRequest) -> str:
    expires = int(time.time()) + 20
    return f'{expires}.{_signature(request, expires)}'


def verify_token(request: ScreeningRequest, token: str) -> bool:
    expiry, _, signature = token.partition('.')
    if not expiry.isascii() or not expiry.isdecimal() or len(expiry) > 12:
        return False
    if len(signature) != 64 or not signature.isascii():
        return False
    expires = int(expiry)
    return expires >= time.time() and hmac.compare_digest(signature, _signature(request, expires))
