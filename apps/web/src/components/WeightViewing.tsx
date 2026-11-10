import { useEffect, useMemo, useState } from 'react'
import { incomeOptions, professionOptions } from '../form/options'
import type { Country } from '../form/types'

const riskFactors = [
  ['country_weight', 'Country'],
  ['nationality_weight', 'Nationality'],
  ['tax_domicile_weight', 'Tax domicile'],
  ['professional_activity_weight', 'Professional activity'],
  ['income_weight', 'Income'],
] as const

type RiskFactor = (typeof riskFactors)[number][0]
type WeightValues = Record<RiskFactor, string>
type RiskValueChoice = { value: string; label: string }
type RiskValueOptions = Record<RiskFactor, RiskValueChoice[]>
type RiskValueValues = Record<RiskFactor, Record<string, string>>
type RiskValueUpdates = Partial<Record<RiskFactor, Record<string, number>>>
type CountryRiskEntry = { country: string; risk: string }
type CountryRiskFactor =
  | 'country_weight'
  | 'nationality_weight'
  | 'tax_domicile_weight'
type CountryRiskEntryLists = Record<CountryRiskFactor, CountryRiskEntry[]>

const countryRiskFactors: CountryRiskFactor[] = [
  'country_weight',
  'nationality_weight',
  'tax_domicile_weight',
]

const emptyWeights = Object.fromEntries(
  riskFactors.map(([key]) => [key, '']),
) as WeightValues

function getRiskValueOptions(countries: Country[]): RiskValueOptions {
  const countryChoices = countries.map(({ code, name }) => ({
    value: code,
    label: name,
  }))
  const listChoices = (values: string[]) =>
    values.map((value) => ({ value, label: value }))
  return {
    country_weight: countryChoices,
    nationality_weight: countryChoices,
    tax_domicile_weight: countryChoices,
    professional_activity_weight: listChoices(professionOptions),
    income_weight: listChoices(incomeOptions),
  }
}

function createEmptyRiskValues(options: RiskValueOptions): RiskValueValues {
  return Object.fromEntries(
    riskFactors.map(([key]) => [
      key,
      Object.fromEntries(options[key].map(({ value }) => [value, ''])),
    ]),
  ) as RiskValueValues
}

function getCountryRiskEntries(
  riskValues: RiskValueValues,
): CountryRiskEntryLists {
  return Object.fromEntries(
    countryRiskFactors.map((factor) => [
      factor,
      Object.entries(riskValues[factor])
        .filter(([, risk]) => risk !== '')
        .map(([country, risk]) => ({ country, risk })),
    ]),
  ) as CountryRiskEntryLists
}

function isCountryRiskFactor(key: RiskFactor): key is CountryRiskFactor {
  return countryRiskFactors.some((factor) => factor === key)
}

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseWeights(
  payload: unknown,
  options: RiskValueOptions,
): {
  version: string
  weights: WeightValues
  riskValues: RiskValueValues
  countryRiskEntries: CountryRiskEntryLists
} {
  if (!isRecord(payload) || !('weights' in payload)) {
    throw new Error('The weights endpoint did not return a weights object.')
  }

  const rawWeights = payload.weights
  if (!isRecord(rawWeights)) {
    throw new Error('The weights endpoint returned an invalid weights object.')
  }

  const weights = { ...emptyWeights }
  const riskValues = createEmptyRiskValues(options)
  for (const [key] of riskFactors) {
    if (!(key in rawWeights)) continue
    const value = rawWeights[key]
    if (
      (typeof value === 'number' || typeof value === 'string') &&
      Number.isInteger(Number(value)) &&
      Number(value) >= 1 &&
      Number(value) <= 5
    ) {
      weights[key] = String(value)
    }
  }

  if ('risk_values' in payload && isRecord(payload.risk_values)) {
    for (const [factor] of riskFactors) {
      const current = payload.risk_values[factor]
      if (!isRecord(current)) continue
      for (const { value: choice } of options[factor]) {
        const value = current[choice]
        if (
          (typeof value === 'number' || typeof value === 'string') &&
          Number.isInteger(Number(value)) &&
          Number(value) >= 1 &&
          Number(value) <= 5
        ) {
          riskValues[factor][choice] = String(value)
        }
      }
    }
  }

  const version =
    'version' in payload && typeof payload.version === 'string'
      ? payload.version
      : 'Current'
  return {
    version,
    weights,
    riskValues,
    countryRiskEntries: getCountryRiskEntries(riskValues),
  }
}

async function getErrorMessage(response: Response) {
  try {
    const body: unknown = await response.json()
    if (
      body !== null &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }

  return `Request failed (${response.status}).`
}

export function WeightViewing({ countries }: { countries: Country[] }) {
  const riskValueOptions = useMemo(() => getRiskValueOptions(countries), [countries])
  const emptyRiskValues = createEmptyRiskValues(riskValueOptions)
  const [weights, setWeights] = useState<WeightValues>(emptyWeights)
  const [savedWeights, setSavedWeights] = useState<WeightValues | null>(null)
  const [riskValues, setRiskValues] = useState<RiskValueValues>(emptyRiskValues)
  const [savedRiskValues, setSavedRiskValues] = useState<RiskValueValues | null>(null)
  const [countryRiskEntries, setCountryRiskEntries] =
    useState<CountryRiskEntryLists>(() => getCountryRiskEntries(emptyRiskValues))
  const [version, setVersion] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadWeights() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch(`${getApiUrl()}/v1/weights/latest`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(await getErrorMessage(response))
        }

        const configuration = parseWeights(await response.json(), riskValueOptions)
        setWeights(configuration.weights)
        setSavedWeights(configuration.weights)
        setRiskValues(configuration.riskValues)
        setSavedRiskValues(configuration.riskValues)
        setCountryRiskEntries(configuration.countryRiskEntries)
        setVersion(configuration.version)
      } catch (requestError) {
        if (controller.signal.aborted) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load risk weights.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadWeights()
    return () => controller.abort()
  }, [retry, riskValueOptions])

  const isEmployeeIdValid = /^\d{10}$/.test(employeeId)
  const isWeightComplete =
    isEmployeeIdValid && riskFactors.every(([key]) => weights[key] !== '')
  const hasWeightChanges =
    savedWeights === null ||
    riskFactors.some(([key]) => weights[key] !== savedWeights[key])
  const currentRiskValues: RiskValueValues = {
    ...riskValues,
    ...Object.fromEntries(
      countryRiskFactors.map((factor) => [
        factor,
        Object.fromEntries(
          countryRiskEntries[factor]
            .filter(({ country, risk }) => country && risk)
            .map(({ country, risk }) => [country, risk]),
        ),
      ]),
    ),
  }
  const riskValueUpdates: RiskValueUpdates = {}
  for (const [factor] of riskFactors) {
    const current = currentRiskValues[factor]
    const saved = savedRiskValues?.[factor] ?? {}
    const choices = new Set([...Object.keys(current), ...Object.keys(saved)])
    const updates: Record<string, number> = {}
    for (const choice of choices) {
      const currentValue = current[choice] || ''
      const savedValue = saved[choice] || ''
      if (currentValue !== '' && currentValue !== savedValue) {
        updates[choice] = Number(currentValue)
      }
    }
    if (Object.keys(updates).length > 0) riskValueUpdates[factor] = updates
  }
  const hasRiskValueChanges = Object.keys(riskValueUpdates).length > 0

  function updateWeight(field: RiskFactor, value: string) {
    setWeights((current) => ({ ...current, [field]: value }))
    setSaveMessage('')
    setSaveError('')
  }

  function updateRiskValue(
    factor: RiskFactor,
    choice: string,
    value: string,
  ) {
    setRiskValues((current) => ({
      ...current,
      [factor]: { ...current[factor], [choice]: value },
    }))
    setSaveMessage('')
    setSaveError('')
  }

  function updateCountryRiskEntry(
    factor: CountryRiskFactor,
    index: number,
    field: keyof CountryRiskEntry,
    value: string,
  ) {
    setCountryRiskEntries((current) =>
      ({
        ...current,
        [factor]: current[factor].map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, [field]: value } : entry,
        ),
      }),
    )
    setSaveMessage('')
    setSaveError('')
  }

  function addCountryRiskEntry(factor: CountryRiskFactor) {
    setCountryRiskEntries((current) => ({
      ...current,
      [factor]: [...current[factor], { country: '', risk: '' }],
    }))
    setSaveMessage('')
    setSaveError('')
  }

  function removeCountryRiskEntry(factor: CountryRiskFactor, index: number) {
    setCountryRiskEntries((current) => ({
      ...current,
      [factor]: current[factor].filter((_, entryIndex) => entryIndex !== index),
    }))
    setSaveMessage('')
    setSaveError('')
  }

  async function saveConfiguration(payload: {
    weights?: Record<string, number>
    risk_values?: RiskValueUpdates
  }) {
    setSaving(true)
    setSaveMessage('')
    setSaveError('')

    try {
      const response = await fetch(`${getApiUrl()}/v1/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          ...payload,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const result: unknown = await response.json()
      if (
        result !== null &&
        typeof result === 'object' &&
        'version' in result &&
        typeof result.version === 'string'
      ) {
        setVersion(result.version)
      }

      if (payload.weights) {
        setSavedWeights({ ...weights })
        setSaveMessage('The API accepted the weight update.')
      } else {
        setSavedRiskValues((current) => {
          const saved = current
            ? structuredClone(current)
            : createEmptyRiskValues(riskValueOptions)
          for (const [factor] of riskFactors) {
            for (const [choice, risk] of Object.entries(
              payload.risk_values?.[factor] ?? {},
            )) {
              saved[factor][choice] = String(risk)
            }
          }
          return saved
        })
        setSaveMessage('The API accepted the risk value update.')
      }
    } catch (requestError) {
      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not save risk weights.',
      )
    } finally {
      setSaving(false)
    }
  }

  function saveWeights() {
    return saveConfiguration({
      weights: Object.fromEntries(
        riskFactors.map(([key]) => [key, Number(weights[key])]),
      ),
    })
  }

  function saveRiskValues(factor: RiskFactor) {
    return saveConfiguration({
      risk_values: { [factor]: riskValueUpdates[factor] },
    })
  }

  return (
    <section className="data-view" aria-labelledby="weight-view-title">
      <div className="data-view-heading">
        <div>
          <span className="data-view-eyebrow">SCORING CONFIGURATION</span>
          <h2 id="weight-view-title">Weight viewing</h2>
          <p>Review the active configuration or prepare a new weight version.</p>
        </div>
        <span className="data-view-count">
          {version ? `Version ${version}` : loading ? 'Loading…' : 'Draft'}
        </span>
      </div>

      <section className="data-view-card current-weights" aria-labelledby="current-weights-title">
        <div className="weight-editor-heading">
          <div>
            <h3 id="current-weights-title">Current weights</h3>
            <p>
              {version
                ? `Saved configuration · Version ${version}`
                : 'Active saved configuration'}
            </p>
          </div>
          {loading && <span className="current-weights-status" role="status">Loading…</span>}
        </div>
        {savedWeights ? (
          <>
            <div className="current-weights-grid">
              {riskFactors.map(([key, label]) => (
                <div className="current-weight-item" key={key}>
                  <span>{label} weight</span>
                  <strong>{savedWeights[key] || '—'}</strong>
                </div>
              ))}
            </div>
            {savedRiskValues && (
              <div className="current-risk-values">
                {riskFactors.map(([key, label]) => (
                  <details className="risk-value-group" key={key}>
                    <summary>{label} risk values</summary>
                    <dl>
                      {riskValueOptions[key].map(({ value, label: choiceLabel }) => (
                        <div key={value}>
                          <dt>{choiceLabel}</dt>
                          <dd>{savedRiskValues[key][value] || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="current-weights-empty">
            {loadError
              ? 'Current weights are unavailable because the API could not load them.'
              : loading
                ? 'Retrieving the current saved configuration.'
                : 'No saved weight configuration is available yet.'}
          </p>
        )}
      </section>

      <div className="data-view-card weight-editor">
        <div className="weight-editor-heading">
          <div>
            <h3>Create a new version</h3>
            <p>Set a weight from 1 to 5 for each factor, then save the draft.</p>
          </div>
          <button
            type="button"
            className="retry-button"
            onClick={() => setRetry((attempt) => attempt + 1)}
            disabled={loading}
          >
            Reload
          </button>
        </div>

        {loadError && (
          <div className="data-view-alert" role="alert">
            <strong>Could not load saved weights</strong>
            <span>
              {loadError} You can still edit a draft below; it will not be
              treated as saved unless the API confirms it.
            </span>
          </div>
        )}

        <label className="employee-id-field" htmlFor="weight-employee-id">
          Employee internal ID
          <input
            id="weight-employee-id"
            type="text"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            value={employeeId}
            onChange={(event) =>
              setEmployeeId(event.target.value.replace(/\D/g, '').slice(0, 10))
            }
            placeholder="10 digits"
            aria-describedby="weight-employee-id-hint"
          />
          <span id="weight-employee-id-hint">Required for the configuration audit log.</span>
        </label>

        <div className="weight-editor-list">
          {riskFactors.map(([key, label], index) => (
            <label className="weight-editor-row" key={key} htmlFor={`weight-${key}`}>
              <span className="weight-editor-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="weight-editor-label">{label}</span>
              <select
                id={`weight-${key}`}
                value={weights[key]}
                onChange={(event) => updateWeight(key, event.target.value)}
                aria-label={`${label} weight`}
              >
                <option value="">Select weight</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="weight-section-actions">
          <button
            type="button"
            className="button-primary weight-save-button"
            onClick={saveWeights}
            disabled={!isWeightComplete || !hasWeightChanges || saving}
          >
            {saving ? 'Submitting…' : 'Submit weights'}
          </button>
        </div>

        <div className="risk-value-editor">
          <h4>Risk values by selectable choice</h4>
          <p>
            Submit each factor separately. Only selected values that you change
            are sent; the backend carries all other values forward from the
            previous version.
          </p>
          {riskFactors.map(([key, label]) => (
            <details className="risk-value-group" key={key}>
              <summary>{label} values</summary>
              {isCountryRiskFactor(key) ? (
                <div className="country-risk-list">
                  {countryRiskEntries[key].map(({ country, risk }, index) => (
                    <div className="country-risk-row" key={`${key}-${index}`}>
                      <label>
                        {label}
                        <select
                          value={country}
                          onChange={(event) =>
                            updateCountryRiskEntry(
                              key,
                              index,
                              'country',
                              event.target.value,
                            )
                          }
                          aria-label={`${label} for risk value ${index + 1}`}
                        >
                          <option value="">Select {label.toLowerCase()}</option>
                          {riskValueOptions[key].map(({ value, label: choiceLabel }) => (
                            <option
                              value={value}
                              key={value}
                              disabled={countryRiskEntries[key].some(
                                (entry, entryIndex) =>
                                  entryIndex !== index && entry.country === value,
                              )}
                            >
                              {choiceLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Risk
                        <select
                          value={risk}
                          onChange={(event) =>
                            updateCountryRiskEntry(
                              key,
                              index,
                              'risk',
                              event.target.value,
                            )
                          }
                          aria-label={`Risk value for ${label.toLowerCase()} ${country || index + 1}`}
                        >
                          <option value="">Select risk</option>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option value={value} key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="button-secondary country-risk-remove"
                        onClick={() => removeCountryRiskEntry(key, index)}
                        aria-label={`Remove ${label.toLowerCase()} risk value ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="retry-button"
                    onClick={() => addCountryRiskEntry(key)}
                    disabled={
                      countryRiskEntries[key].length >= riskValueOptions[key].length
                    }
                  >
                    Add {label.toLowerCase()} risk
                  </button>
                </div>
              ) : (
                <div className="risk-value-options">
                  {riskValueOptions[key].map(({ value: choice, label }) => (
                    <label className="risk-value-row" key={choice}>
                      <span>{label}</span>
                      <select
                        value={riskValues[key][choice] || ''}
                        onChange={(event) =>
                          updateRiskValue(key, choice, event.target.value)
                        }
                        aria-label={`${label} risk value for ${choice}`}
                      >
                        <option value="">Select value</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option value={value} key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <div className="risk-section-actions">
                <button
                  type="button"
                  className="button-primary weight-save-button"
                  onClick={() => void saveRiskValues(key)}
                  disabled={!isEmployeeIdValid || !riskValueUpdates[key] || saving}
                >
                  {saving ? 'Submitting…' : `Submit ${label.toLowerCase()} values`}
                </button>
              </div>
            </details>
          ))}
        </div>

        <div className="weight-editor-footer">
          <p className="data-view-note">
            {savedWeights === null
              ? 'These are unsaved draft values. The saved configuration could not be loaded.'
              : hasWeightChanges || hasRiskValueChanges
                ? 'You have unsaved changes. Submit weights and risk values separately.'
                : 'No unsaved changes.'}
          </p>
        </div>
        {saveError && (
          <div className="data-view-alert data-view-alert-error" role="alert">
            <strong>Could not submit configuration changes</strong>
            <span>{saveError} Your changes remain as an unsaved draft.</span>
          </div>
        )}
        {saveMessage && (
          <p className="weight-save-success" role="status">{saveMessage}</p>
        )}
      </div>
    </section>
  )
}
