import { useEffect, useMemo, useState } from 'react'
import type { ClientForm, Country } from '../form/types'

const riskFactors = [
  {
    key: 'country_weight',
    label: 'Country',
    clientField: 'countryOfResidence',
  },
  { key: 'nationality_weight', label: 'Nationality', clientField: 'nationality' },
  {
    key: 'tax_domicile_weight',
    label: 'Tax domicile',
    clientField: 'taxDomicile',
  },
  {
    key: 'professional_activity_weight',
    label: 'Professional activity',
    clientField: 'profession',
  },
  { key: 'income_weight', label: 'Income', clientField: 'annualIncome' },
] as const

type WeightKey = (typeof riskFactors)[number]['key']
type SavedConfiguration = {
  weights: Record<WeightKey, number>
  riskValues: Record<WeightKey, Record<string, number>>
  version: string | number
}

type RiskFactorResult = {
  label: string
  value: string
  weight: number
  score: number
  contribution: number
}

type Evaluation = {
  score: number | null
  tier: string | null
  weightVersion: string | number | null
  factors: RiskFactorResult[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseConfiguration(payload: unknown): SavedConfiguration {
  if (!isRecord(payload) || !isRecord(payload.weights) || !isRecord(payload.risk_values)) {
    throw new Error('The saved weight configuration has an invalid format.')
  }

  const weights = {} as Record<WeightKey, number>
  const riskValues = {} as Record<WeightKey, Record<string, number>>
  for (const factor of riskFactors) {
    const weight = payload.weights[factor.key]
    const values = payload.risk_values[factor.key]
    if (
      typeof weight !== 'number' ||
      weight < 1 ||
      weight > 5 ||
      !Number.isInteger(weight) ||
      !isRecord(values)
    ) {
      throw new Error(`Saved configuration is missing ${factor.label} values.`)
    }

    weights[factor.key] = weight
    riskValues[factor.key] = {}
    for (const [choice, score] of Object.entries(values)) {
      if (
        typeof score !== 'number' ||
        !Number.isInteger(score) ||
        score < 1 ||
        score > 5
      ) {
        throw new Error(`Saved ${factor.label} values must be between 1 and 5.`)
      }
      riskValues[factor.key][choice] = score
    }
  }

  return {
    weights,
    riskValues,
    version:
      'version' in payload &&
      (typeof payload.version === 'number' || typeof payload.version === 'string')
        ? payload.version
        : '—',
  }
}

function evaluateClient(
  client: ClientForm,
  configuration: SavedConfiguration,
  countries: Country[],
): Evaluation {
  const factors: RiskFactorResult[] = []
  for (const factor of riskFactors) {
    const value = client[factor.clientField]
    if (!value) continue
    const score = configuration.riskValues[factor.key][value]
    if (score === undefined) {
      throw new Error(`No saved risk value is configured for ${factor.label}: ${value}.`)
    }
    factors.push({
      label: factor.label,
      value:
        factor.key === 'professional_activity_weight' ||
        factor.key === 'income_weight'
          ? value
          : countries.find((country) => country.code === value)?.name ?? value,
      weight: configuration.weights[factor.key],
      score,
      contribution: 0,
    })
  }

  const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0)
  const score =
    totalWeight === 0
      ? null
      : factors.reduce(
          (total, factor) => total + factor.weight * factor.score,
          0,
        ) / totalWeight

  if (score !== null) {
    for (const factor of factors) {
      factor.contribution = (factor.weight * factor.score) / totalWeight
    }
  }

  const tier =
    score === null
      ? null
      : score < 2.5
        ? 'Low Risk'
        : score < 3.75
          ? 'Medium Risk'
          : 'High Risk'

  return {
    score,
    tier: client.pepConfirmed || client.sanctionsMatch ? 'High Risk' : tier,
    weightVersion: configuration.version,
    factors,
  }
}

export function RiskPreview({
  client,
  countries,
}: {
  client: ClientForm
  countries: Country[]
}) {
  const [configuration, setConfiguration] = useState<SavedConfiguration | null>(null)
  const [configurationError, setConfigurationError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function loadConfiguration() {
      setLoading(true)
      setConfigurationError('')
      try {
        const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
        const response = await fetch(`${apiUrl}/v1/weights/latest`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Weight configuration request failed (${response.status}).`)
        }
        setConfiguration(parseConfiguration(await response.json()))
      } catch (requestError) {
        if (controller.signal.aborted) return
        setConfiguration(null)
        setConfigurationError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load the saved scoring configuration.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadConfiguration()
    return () => controller.abort()
  }, [])

  const { evaluation, evaluationError } = useMemo(() => {
    if (!configuration) return { evaluation: null, evaluationError: '' }
    try {
      return {
        evaluation: evaluateClient(client, configuration, countries),
        evaluationError: '',
      }
    } catch (error) {
      return {
        evaluation: null,
        evaluationError:
          error instanceof Error ? error.message : 'Could not calculate the score.',
      }
    }
  }, [client, configuration, countries])

  const redFlag = client.pepConfirmed || client.sanctionsMatch

  return (
    <section className="risk-preview-card" aria-live="polite">
      <div className="risk-preview-heading">
        <div>
          <span className="data-view-eyebrow">LIVE RISK PREVIEW</span>
          <h2>Provisional assessment</h2>
        </div>
        <span className="risk-preview-refresh" role="status">
          {loading ? 'Loading scoring rules…' : 'Updates as fields change'}
        </span>
      </div>
      {redFlag && (
        <div className="red-flag-banner" role="alert">
          AUTOMATIC HIGH RISK OVERRIDE: {[
            client.sanctionsMatch && 'Sanctions',
            client.pepConfirmed && 'PEP',
          ].filter(Boolean).join(' / ')} Hit Detected
        </div>
      )}
      {evaluation && (
        <>
          <div className="risk-preview-summary">
            <div><span>Score</span><strong>{evaluation.score?.toFixed(2) ?? '—'} / 5</strong></div>
            <div><span>Risk tier</span><strong>{evaluation.tier || '—'}</strong></div>
            <div><span>Weight version</span><strong>{evaluation.weightVersion ?? '—'}</strong></div>
          </div>
          <div className="risk-preview-table-wrap">
            <table className="risk-preview-table">
              <thead>
                <tr><th>Risk factor</th><th>Selected value</th><th>Weight</th><th>Risk value</th><th>Contribution</th></tr>
              </thead>
              <tbody>
                {evaluation.factors.map((factor) => (
                  <tr key={factor.label}>
                    <td>{factor.label}</td>
                    <td>{factor.value}</td>
                    <td>{factor.weight}</td>
                    <td>{factor.score}</td>
                    <td>{factor.contribution.toFixed(2)}</td>
                  </tr>
                ))}
                {evaluation.factors.length === 0 && (
                  <tr><td colSpan={5}>Select scoring values to calculate a provisional score.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(configurationError || evaluationError) && (
        <div className="data-view-alert" role="status">
          <strong>Provisional score unavailable</strong>
          <span>
            {configurationError || evaluationError} Complete saved weights and
            risk-value mappings are required. Unselected factors contribute zero.
          </span>
        </div>
      )}
    </section>
  )
}
