import pydantic


class HealthCheckResponse(pydantic.BaseModel):
    status: str
    service: str

    
class IncomeRangeResponse(pydantic.BaseModel):
    id: int
    label: str


class ProfessionalCategoryResponse(pydantic.BaseModel):
    id: int
    name: str


class CountryResponse(pydantic.BaseModel):
    code: str = pydantic.Field(pattern="^[A-Z]{2}$")
    name: str

