from pydantic import BaseModel


class ApiIndexResponse(BaseModel):
    message: str
    docs: str
