from typing import Annotated

from pydantic import BaseModel, Field, SecretStr


class OfficerLoginRequest(BaseModel):
    officerId: Annotated[str, Field(pattern=r'^[0-9]{10}$')]
    officerPassword: SecretStr = Field(min_length=1, max_length=1024)


class OfficerLoginResponse(BaseModel):
    officerId: str
    isAdmin: bool
