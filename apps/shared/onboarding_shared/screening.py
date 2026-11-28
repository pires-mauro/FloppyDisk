from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


MatchDecision = Literal['confirmed', 'dismissed']


class ScreeningRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    birthDate: date
    nationality: str
    decisions: dict[str, MatchDecision] = Field(default_factory=dict)


class ScreeningRoleEvidence(BaseModel):
    role: str
    redFlag: bool | None


class ScreeningCandidate(BaseModel):
    entityId: str
    name: str
    birthDates: list[str]
    nationalities: list[str]
    countries: list[str]
    sources: list[str]
    roles: list[ScreeningRoleEvidence]
    decision: MatchDecision | None = None


class ScreeningResult(BaseModel):
    available: bool = True
    sourceSha256: str | None = None
    candidates: list[ScreeningCandidate] = Field(default_factory=list)

    def confirmed_roles(self) -> set[str]:
        return {role.role for candidate in self.candidates if candidate.decision == 'confirmed'
                for role in candidate.roles}

    def red_flagged_roles(self) -> set[str]:
        return {role.role for candidate in self.candidates if candidate.decision == 'confirmed'
                for role in candidate.roles if role.redFlag}

    def requires_confirmation(self) -> bool:
        return not self.available or any(candidate.decision is None for candidate in self.candidates)


def screening_outcome(tier: str, reason: str | None, screening: ScreeningResult) -> tuple[str, str | None]:
    red_flags = screening.red_flagged_roles()
    if red_flags:
        return 'High Risk', 'Confirmed screening red flag: ' + ', '.join(sorted(red_flags))
    if tier == 'High Risk':
        return tier, reason
    if not screening.available:
        return 'Medium Risk', 'OpenSanctions screening unavailable'
    if screening.requires_confirmation():
        return 'Medium Risk', 'Review the potential OpenSanctions matches'
    roles = screening.confirmed_roles()
    if roles:
        return 'Medium Risk', 'Confirmed screening match: ' + ', '.join(sorted(roles))
    return tier, reason
