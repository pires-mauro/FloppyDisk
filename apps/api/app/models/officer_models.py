from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, SecretStr


OFFICER_CREDENTIALS_EXAMPLE = {
    "officerId": "0000000000",
    "officerPassword": "replace-with-officer-password",
}


class OfficerLoginRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [OFFICER_CREDENTIALS_EXAMPLE]})

    officerId: Annotated[str, Field(pattern=r'^[0-9]{10}$')]
    officerPassword: SecretStr = Field(min_length=1, max_length=1024)


class OfficerLoginResponse(BaseModel):
    officerId: str
    isAdmin: bool
