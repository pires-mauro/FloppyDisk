import base64

from fastapi import Request
from fastapi.security import HTTPBasic
from fastapi.security.utils import get_authorization_scheme_param

from app.models.officer_models import OfficerLoginRequest


class OfficerBasicAuth(HTTPBasic):
    async def __call__(self, request: Request) -> OfficerLoginRequest:
        scheme, encoded = get_authorization_scheme_param(request.headers.get("Authorization"))
        if scheme.lower() != "basic":
            raise self.make_not_authenticated_error()
        try:
            decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
            officer_id, separator, password = decoded.partition(":")
            if not separator:
                raise ValueError("Invalid officer credentials")
            return OfficerLoginRequest(officerId=officer_id, officerPassword=password)
        except ValueError as exc:
            raise self.make_not_authenticated_error() from exc
