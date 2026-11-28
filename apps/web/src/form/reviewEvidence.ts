export type RiskFactorResult = {
  label: string
  value: string
  weight: number
  score: number | null
  contribution: number | null
}

export type MatchDecision = 'confirmed' | 'dismissed'

export type ScreeningCandidate = {
  entityId: string
  name: string
  birthDates: string[]
  nationalities: string[]
  countries: string[]
  sources: string[]
  roles: { role: string; redFlag: boolean | null }[]
  decision: MatchDecision | null
}

export type Screening = {
  available: boolean
  candidates: ScreeningCandidate[]
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isRiskFactor(value: unknown): value is RiskFactorResult {
  return isRecord(value) && typeof value.label === 'string' && typeof value.value === 'string' &&
    typeof value.weight === 'number' && (typeof value.score === 'number' || value.score === null) &&
    (typeof value.contribution === 'number' || value.contribution === null)
}

export function isScreening(value: unknown): value is Screening {
  return isRecord(value) && typeof value.available === 'boolean' &&
    Array.isArray(value.candidates) && value.candidates.every((candidate) =>
      isRecord(candidate) && typeof candidate.entityId === 'string' && typeof candidate.name === 'string' &&
      isStringList(candidate.birthDates) && isStringList(candidate.nationalities) &&
      isStringList(candidate.countries) && isStringList(candidate.sources) &&
      (candidate.decision === null || candidate.decision === 'confirmed' || candidate.decision === 'dismissed') &&
      Array.isArray(candidate.roles) && candidate.roles.every((entry) =>
        isRecord(entry) && typeof entry.role === 'string' &&
        (entry.redFlag === null || typeof entry.redFlag === 'boolean'),
      ),
    )
}

export function formatScore(score: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(score)
}
