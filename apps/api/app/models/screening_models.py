from typing import Annotated

from pydantic import BaseModel, Field, StrictBool

from app.models.officer_models import OfficerLoginRequest


RoleCode = Annotated[str, Field(min_length=1)]


class ScreeningRole(BaseModel):
    role: str
    red_flag: bool | None


class ScreeningRoleUpdate(OfficerLoginRequest):
    updates: Annotated[dict[RoleCode, StrictBool], Field(min_length=1)]
