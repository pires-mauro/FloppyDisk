import { useEffect, useMemo, useState } from 'react'
import { incomeOptions, professionOptions } from '../form/options'
import type { Country } from '../form/types'
import type { OfficerSession } from './OfficerLogin'

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
type RiskValueEntry = { choice: string; risk: string }
type RiskValueEntryLists = Record<RiskFactor, RiskValueEntry[]>
const countryRiskFactors: RiskFactor[] = [
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

function createEmptyRiskValueEntries(): RiskValueEntryLists {
  return {
    country_weight: [],
    nationality_weight: [],
    tax_domicile_weight: [],
    professional_activity_weight: [],
    income_weight: [],
  }
}

function isCountryRiskFactor(key: RiskFactor): boolean {
  return countryRiskFactors.includes(key)
}

const editableRiskFactors = riskFactors.filter(([key]) =>
  key === 'country_weight' || key === 'professional_activity_weight' || key === 'income_weight',
)

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
      String(value).trim() !== '' &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
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
          String(value).trim() !== '' &&
          Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
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
  }
}

async function getErrorMessage(response: Response) {
  if (response.status === 401) {
    return 'The officer ID or password is incorrect. Check your credentials and try again.'
  }
  if (response.status === 403) {
    return "Only an admin officer can save weights or risk values. Use an admin officer's credentials."
  }

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

export function WeightViewing({
  countries,
  session,
}: {
  countries: Country[]
  session: OfficerSession
}) {
  const riskValueOptions = useMemo(() => getRiskValueOptions(countries), [countries])
  const [weights, setWeights] = useState<WeightValues>(emptyWeights)
  const [savedWeights, setSavedWeights] = useState<WeightValues | null>(null)
  const [savedRiskValues, setSavedRiskValues] = useState<RiskValueValues | null>(null)
  const [riskValueEntries, setRiskValueEntries] =
    useState<RiskValueEntryLists>(createEmptyRiskValueEntries)
  const [version, setVersion] = useState('')
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
        setSavedRiskValues(configuration.riskValues)
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

  const isWeightComplete =
    riskFactors.every(([key]) => weights[key] !== '' &&
      Number.isFinite(Number(weights[key])) && Number(weights[key]) >= 0 && Number(weights[key]) <= 5 &&
      Math.abs(Number(weights[key]) * 100 - Math.round(Number(weights[key]) * 100)) < 1e-8) &&
    riskFactors.reduce((sum, [key]) => sum + Number(weights[key]), 0) > 0
  const hasWeightChanges =
    savedWeights === null ||
    riskFactors.some(([key]) => weights[key] !== savedWeights[key])
  const riskValueUpdates: RiskValueUpdates = {}
  const hasIncompleteRiskEntries: Partial<Record<RiskFactor, boolean>> = {}
  for (const [factor] of riskFactors) {
    const saved = savedRiskValues?.[factor] ?? {}
    const updates: Record<string, number> = {}
    const entries = riskValueEntries[factor]
    hasIncompleteRiskEntries[factor] = entries.some(({ choice, risk }) =>
      !choice || risk === '' || !Number.isFinite(Number(risk)) ||
      Number(risk) < 0 || Number(risk) > 5 ||
      Math.abs(Number(risk) * 100 - Math.round(Number(risk) * 100)) > 1e-8,
    )
    for (const { choice, risk } of entries) {
      if (choice && risk !== '' && Number.isFinite(Number(risk)) &&
          Number(risk) >= 0 && Number(risk) <= 5 &&
          Math.abs(Number(risk) * 100 - Math.round(Number(risk) * 100)) <= 1e-8 &&
          saved[choice] !== risk) {
        updates[choice] = Number(risk)
      }
    }
    if (Object.keys(updates).length > 0 && !hasIncompleteRiskEntries[factor]) {
      riskValueUpdates[factor] = updates
    }
  }
  const countryEntries = riskValueEntries.country_weight
  const countryEntriesIncomplete = hasIncompleteRiskEntries.country_weight === true
  const countryChanges = countryEntries.some(({ choice, risk }) =>
    choice && risk !== '' && countryRiskFactors.some((factor) =>
      savedRiskValues?.[factor]?.[choice] !== risk,
    ),
  )
  if (countryChanges && !countryEntriesIncomplete) {
    const countryUpdates = Object.fromEntries(
      countryEntries.map(({ choice, risk }) => [choice, Number(risk)]),
    )
    for (const factor of countryRiskFactors) {
      riskValueUpdates[factor] = countryUpdates
    }
  }
  const hasRiskValueChanges = Object.keys(riskValueUpdates).length > 0

  function updateWeight(field: RiskFactor, value: string) {
    setWeights((current) => ({ ...current, [field]: value }))
    setSaveMessage('')
    setSaveError('')
  }

  function updateRiskValueEntry(
    factor: RiskFactor,
    index: number,
    field: keyof RiskValueEntry,
    value: string,
  ) {
    setRiskValueEntries((current) => ({
      ...current,
      [factor]: current[factor].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }))
    setSaveMessage('')
    setSaveError('')
  }

  function addRiskValueEntry(factor: RiskFactor) {
    setRiskValueEntries((current) => ({
      ...current,
      [factor]: [...current[factor], { choice: '', risk: '' }],
    }))
    setSaveMessage('')
    setSaveError('')
  }

  function removeRiskValueEntry(factor: RiskFactor, index: number) {
    setRiskValueEntries((current) => ({
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
          employee_id: session.officerId,
          password: session.password,
          ...payload,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const result: unknown = await response.json()
      const savedVersion =
        result !== null &&
        typeof result === 'object' &&
        'version' in result &&
        (typeof result.version === 'string' ||
          (typeof result.version === 'number' &&
            Number.isInteger(result.version)))
          ? String(result.version)
          : ''
      if (!savedVersion) {
        throw new Error('The weights endpoint did not return a saved version.')
      }
      setVersion(savedVersion)

      if (payload.weights) {
        setSavedWeights({ ...weights })
        setSaveMessage(`Weight update saved as version ${savedVersion}.`)
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
        setRiskValueEntries((current) => {
          const next = { ...current }
          for (const [factor] of riskFactors) {
            if (payload.risk_values?.[factor]) next[factor] = []
          }
          return next
        })
        setSaveMessage(`Risk value update saved as version ${savedVersion}.`)
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
    const factorsToSave = isCountryRiskFactor(factor)
      ? countryRiskFactors
      : [factor]
    const updates: RiskValueUpdates = {}
    for (const target of factorsToSave) {
      const changes = riskValueUpdates[target]
      if (hasIncompleteRiskEntries[target] || (target === 'country_weight' && countryEntriesIncomplete)) {
        setSaveError('Risk values must be between 0 and 5 with at most two decimal places.')
        return
      }
      if (changes) updates[target] = changes
    }
    return saveConfiguration({
      risk_values: updates,
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
                {editableRiskFactors.map(([key, label]) => (
                  <details className="risk-value-group" key={key}>
                    <summary>
                      {label === 'Country' ? 'Country, nationality and tax domicile risk values' : `${label} risk values`}
                    </summary>
                    <table className="saved-risk-values">
                      <thead>
                        <tr>
                          <th scope="col">{key === 'country_weight' ? 'Country' : 'Choice'}</th>
                          <th scope="col">Risk value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskValueOptions[key]
                          .filter(({ value }) => savedRiskValues[key][value])
                          .map(({ value, label: choiceLabel }) => (
                            <tr key={value}>
                              <th scope="row">{choiceLabel}</th>
                              <td>{savedRiskValues[key][value]}</td>
                            </tr>
                          ))}
                        {!riskValueOptions[key].some(
                          ({ value }) => savedRiskValues[key][value],
                        ) && (
                          <tr>
                            <td colSpan={2}>No risk values configured.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
            <p>Set weights from 0 to 5 with up to two decimal places. At least one must be positive. Weights are normalized when scoring.</p>
            <p className="data-view-note">
              {session.isAdmin
                ? 'Changes will be recorded under your signed-in admin account.'
                : 'Only an admin officer can save weights or risk values. Sign in with an admin account to make changes.'}
            </p>
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

        <div className="weight-editor-list">
          {riskFactors.map(([key, label], index) => (
            <label className="weight-editor-row" key={key} htmlFor={`weight-${key}`}>
              <span className="weight-editor-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="weight-editor-label">{label}</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.01}
                id={`weight-${key}`}
                value={weights[key]}
                onChange={(event) => updateWeight(key, event.target.value)}
                aria-label={`${label} weight`}
              />
            </label>
          ))}
        </div>
        <div className="weight-section-actions">
          <button
            type="button"
            className="button-primary weight-save-button"
            onClick={() => void saveWeights()}
            disabled={
              !isWeightComplete ||
              !hasWeightChanges ||
              !session.isAdmin ||
              saving
            }
          >
            {saving ? 'Submitting…' : 'Submit weights'}
          </button>
          {!session.isAdmin && (
            <span className="data-view-note">Sign in with an admin account to submit weight changes.</span>
          )}
          {session.isAdmin && !isWeightComplete && (
            <span className="data-view-note">Enter all five weights from 0 to 5 using at most two decimal places; at least one must be positive.</span>
          )}
          {session.isAdmin && isWeightComplete && !hasWeightChanges && (
            <span className="data-view-note">Change a weight value before submitting.</span>
          )}
        </div>

        <div className="risk-value-editor">
          <h4>Risk values by selectable choice</h4>
          <p>
            Risk values must be between 0 and 5, with at most two decimal places.
            {' '}
            Country values are shared by country, nationality and tax domicile.
            Submit other factors separately; only changed values are sent, and
            all other values carry forward from the previous version.
          </p>
          {editableRiskFactors.map(([key, label]) => (
            <details className="risk-value-group" key={key}>
              <summary>
                {label === 'Country' ? 'Country values' : `${label} values`}
              </summary>
                <p className="data-view-note">
                  Add a row, choose a {key === 'country_weight' ? 'country' : label.toLowerCase()},
                  and enter its risk value. The list starts empty.
                </p>
                <div className="country-risk-list">
                  {riskValueEntries[key].map(({ choice, risk }, index) => (
                    <div className="country-risk-row" key={`${key}-${index}`}>
                      <label>
                        {key === 'country_weight' ? 'Country' : label}
                        <select
                          value={choice}
                          onChange={(event) =>
                            updateRiskValueEntry(
                              key,
                              index,
                              'choice',
                              event.target.value,
                            )
                          }
                          aria-label={`${label} choice for risk value ${index + 1}`}
                        >
                          <option value="">Select {key === 'country_weight' ? 'country' : label.toLowerCase()}</option>
                          {riskValueOptions[key].map(({ value, label: choiceLabel }) => (
                            <option
                              value={value}
                              key={value}
                              disabled={riskValueEntries[key].some(
                                (entry, entryIndex) => entryIndex !== index && entry.choice === value,
                              )}
                            >
                              {choiceLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Risk
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          value={risk}
                          onChange={(event) =>
                            updateRiskValueEntry(
                              key,
                              index,
                              'risk',
                              event.target.value,
                            )
                          }
                          aria-label={`Risk value for ${label.toLowerCase()} ${choice || index + 1}`}
                        />
                      </label>
                      <button
                        type="button"
                        className="button-secondary country-risk-remove"
                        onClick={() => removeRiskValueEntry(key, index)}
                        aria-label={`Remove ${label.toLowerCase()} risk value ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="retry-button"
                    onClick={() => addRiskValueEntry(key)}
                    disabled={riskValueEntries[key].length >= riskValueOptions[key].length}
                  >
                    Add {key === 'country_weight' ? 'country' : label.toLowerCase()} risk value
                  </button>
              </div>
              <div className="risk-section-actions">
                <button
                  type="button"
                  className="button-primary weight-save-button"
                  onClick={() => void saveRiskValues(key)}
                  disabled={
                    !session.isAdmin ||
                    (key === 'country_weight'
                      ? !riskValueUpdates.country_weight
                      : !riskValueUpdates[key]) ||
                    saving
                  }
                >
                  {saving
                    ? 'Submitting…'
                    : key === 'country_weight'
                      ? 'Submit country values'
                      : `Submit ${label.toLowerCase()} values`}
                </button>
                {!session.isAdmin && (
                  <span className="data-view-note">Sign in with an admin account to submit risk values.</span>
                )}
                {session.isAdmin && riskValueEntries[key].length === 0 && (
                  <span className="data-view-note">Add a risk-value row to enable submission.</span>
                )}
                {session.isAdmin && hasIncompleteRiskEntries[key] && (
                  <span className="data-view-note">Complete every row with a choice and a value from 0 to 5 (up to two decimal places).</span>
                )}
                {session.isAdmin &&
                  riskValueEntries[key].length > 0 &&
                  !hasIncompleteRiskEntries[key] &&
                  !riskValueUpdates[key] && (
                    <span className="data-view-note">These values are already saved; change a value before submitting.</span>
                  )}
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
