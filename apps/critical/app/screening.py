import os
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException
from pydantic import ValidationError

from onboarding_shared.screening import ScreeningRequest, ScreeningResult


def get_screening_result(request: ScreeningRequest, token: str) -> ScreeningResult:
    backend_url = os.environ.get('SCREENING_BACKEND_URL', 'http://api:8000').rstrip('/')
    lookup = Request(
        f'{backend_url}/api/internal/screening',
        data=request.model_dump_json().encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'},
        method='POST',
    )
    try:
        with urlopen(lookup, timeout=3) as response:
            return ScreeningResult.model_validate_json(response.read())
    except (URLError, OSError, ValidationError) as exc:
        raise HTTPException(status_code=502, detail='The screening lookup could not be completed') from exc
