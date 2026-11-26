from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictBool

RoleCode = Annotated[str, Field(min_length=1)]


class ScreeningRole(BaseModel):
    role: str
    red_flag: bool | None


class ScreeningRoleUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "examples": [{"updates": {"role.pep": False}}],
    })

    updates: Annotated[dict[RoleCode, StrictBool], Field(min_length=1)]
