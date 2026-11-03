from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Factor = Literal['country_weight', 'nationality_weight', 'tax_domicile_weight',
                 'professional_activity_weight', 'income_weight']
Rating = Annotated[int, Field(strict=True, ge=1, le=5)]


class FactorWeights(BaseModel):
    model_config = ConfigDict(extra='forbid')

    country_weight: Rating
    nationality_weight: Rating
    tax_domicile_weight: Rating
    professional_activity_weight: Rating
    income_weight: Rating


class WeightUpdate(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        json_schema_extra={'example': {
            'employee_id': '0000000001',
            'weights': {'country_weight': 3, 'nationality_weight': 2,
                        'tax_domicile_weight': 2, 'professional_activity_weight': 4,
                        'income_weight': 1},
        }},
    )
    employee_id: str = Field(pattern=r'^[0-9]{10}$')
    weights: FactorWeights | None = None
    risk_values: dict[Factor, dict[str, Rating | None]] | None = None

    @model_validator(mode='after')
    def require_update(self):
        if self.weights is None and not any((self.risk_values or {}).values()):
            raise ValueError('Supply weights or at least one risk-value change')
        return self


class WeightVersion(BaseModel):
    version: str


class ScoringConfiguration(WeightVersion):
    weights: FactorWeights
    risk_values: dict[Factor, dict[str, Rating]]
