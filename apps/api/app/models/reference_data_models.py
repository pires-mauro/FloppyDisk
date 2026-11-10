from pydantic import BaseModel, Field


class IncomeRangeResponse(BaseModel):
    id: int
    label: str


class ProfessionalCategoryResponse(BaseModel):
    id: int
    name: str


class CountryResponse(BaseModel):
    code: str = Field(pattern="^[A-Z]{2}$")
    name: str
