import { useEffect, useState } from 'react'
import type { ClientForm, Country } from '../form/types'
import type { OfficerSession } from './OfficerLogin'

type RiskReviewProps = {
  client: ClientForm
  countries: Country[]
  session: OfficerSession
  onBack: () => void
  onDecisionSaved: (preliminary: boolean) => void
}

type RiskTier = 'Low Risk' | 'Medium Risk' | 'High Risk'

type RiskFactorResult = {
  label: string
  value: string
  weight: number
  score: number | null
  contribution: number | null
}

type Evaluation = {
  preliminary: boolean
  scoringRuleVersion: string
  score: number | null
  tier: RiskTier
  weightVersion: number | string
  overrideReason: string | null
  factors: RiskFactorResult[]
  screening: Screening
}

type MatchDecision = 'confirmed' | 'dismissed'

type ScreeningCandidate = {
  entityId: string
  name: string
  birthDates: string[]
  nationalities: string[]
  countries: string[]
  sources: string[]
  roles: { role: string; redFlag: boolean | null }[]
  decision: MatchDecision | null
}

type Screening = {
  available: boolean
  candidates: ScreeningCandidate[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isScreening(value: unknown): value is Screening {
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

function formatScore(score: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(score)
}

async function getErrorMessage(response: Response) {
  if (response.status === 401) {
    return 'The officer ID or password is incorrect. Check your credentials and try again.'
  }
  if (response.status === 403) {
    return 'You do not have permission to complete this action.'
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

  return `Risk score request failed (${response.status}).`
}

export function RiskReview({
  client,
  countries,
  session,
  onBack,
  onDecisionSaved,
}: RiskReviewProps) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [screeningDecisions, setScreeningDecisions] = useState<Record<string, MatchDecision>>({})
  const screeningPending = !evaluation?.screening.available ||
    evaluation.screening.candidates.some(({ decision }) => decision === null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadScore() {
      setLoading(true)
      setError('')
      setEvaluation(null)

      try {
        const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
        const endpoint = Object.keys(screeningDecisions).length ? 'screening/confirm' : 'evaluation'
        const response = await fetch(`${apiUrl}/v1/risk/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...client,
            officerId: session.officerId,
            officerPassword: session.password,
            screeningDecisions,
            address: {
              street: client.addressStreet,
              city: client.addressCity,
              houseNumber: client.addressHouseNumber || null,
              postalCode: client.addressPostalCode || null,
            },
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(await getErrorMessage(response))
        }

        const payload: unknown = await response.json()
        const result = payload !== null && typeof payload === 'object' ? payload : null
        if (
          !result ||
          !('preliminary' in result) || typeof result.preliminary !== 'boolean' ||
          !('score' in result) ||
          (result.score !== null && (typeof result.score !== 'number' || !Number.isFinite(result.score))) ||
          !('weightVersion' in result) ||
          (typeof result.weightVersion !== 'string' && typeof result.weightVersion !== 'number') ||
          !('tier' in result) ||
          (result.tier !== 'Low Risk' && result.tier !== 'Medium Risk' && result.tier !== 'High Risk') ||
          !('screening' in result) || !isScreening(result.screening)
        ) {
          throw new Error('The backend returned an invalid risk score.')
        }

        const score = result.score
        const factors =
          'factors' in result && Array.isArray(result.factors)
            ? result.factors.filter(
                (factor): factor is RiskFactorResult =>
                  factor !== null &&
                  typeof factor === 'object' &&
                  'label' in factor &&
                  typeof factor.label === 'string' &&
                  'value' in factor &&
                  typeof factor.value === 'string' &&
                  'weight' in factor &&
                  typeof factor.weight === 'number' &&
                  'score' in factor &&
                  (typeof factor.score === 'number' || factor.score === null) &&
                  'contribution' in factor &&
                  (typeof factor.contribution === 'number' || factor.contribution === null),
              )
            : []
        setEvaluation({
          preliminary: result.preliminary,
          scoringRuleVersion: 'scoringRuleVersion' in result && typeof result.scoringRuleVersion === 'string'
            ? result.scoringRuleVersion : 'unknown',
          score,
          tier: result.tier,
          weightVersion: result.weightVersion,
          overrideReason:
            'overrideReason' in result &&
            typeof result.overrideReason === 'string'
              ? result.overrideReason
              : null,
          factors,
          screening: result.screening,
        })
      } catch (requestError) {
        if (controller.signal.aborted) return
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not retrieve the risk score.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadScore()
    return () => controller.abort()
  }, [client, retry, screeningDecisions, session.officerId, session.password])

  async function submitDecision(decision: 'approve' | 'manual_review' | 'decline') {
    if (!evaluation || loading || (decision !== 'decline' && screeningPending)) return
    setDecisionLoading(true)
    setDecisionError('')
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
      const response = await fetch(`${apiUrl}/v1/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...client,
          officerId: session.officerId,
          officerPassword: session.password,
          screeningDecisions,
          address: {
            street: client.addressStreet,
            city: client.addressCity,
            houseNumber: client.addressHouseNumber || null,
            postalCode: client.addressPostalCode || null,
          },
          finalDecision: decision,
        }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const payload: unknown = await response.json()
      if (
        payload === null ||
        typeof payload !== 'object' ||
        !('internal_client_id' in payload) ||
        !('preliminary' in payload) || typeof payload.preliminary !== 'boolean'
      ) {
        throw new Error('The API did not confirm a saved client record.')
      }
      onDecisionSaved(payload.preliminary)
    } catch (requestError) {
      setDecisionError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not save the final decision.',
      )
    } finally {
      setDecisionLoading(false)
    }
  }

  const summaryGroups = [
    {
      title: 'Client profile',
      fields: [
        ['Full legal name', client.clientName],
        ['Existing client ID', client.clientId || 'New client'],
        ['Date of birth', client.dateOfBirth],
        [
          'Address',
          [
            client.addressStreet,
            client.addressHouseNumber,
            client.addressPostalCode,
            client.addressCity,
          ]
            .filter(Boolean)
            .join(', '),
        ],
        ['Nationality', countries.find((country) => country.code === client.nationality)?.name ?? client.nationality],
        ['ID issuing country', countries.find((country) => country.code === client.idIssuingCountry)?.name ?? client.idIssuingCountry],
        ['Marital status', client.maritalStatus],
      ],
    },
    {
      title: 'Residence & financial profile',
      fields: [
        ['Country of residence', countries.find((country) => country.code === client.countryOfResidence)?.name ?? client.countryOfResidence],
        ['Tax domicile', countries.find((country) => country.code === client.taxDomicile)?.name ?? client.taxDomicile],
        ['Annual income', client.annualIncome],
        ['Profession / activity', client.profession],
      ],
    },
    {
      title: 'Contact information',
      fields: [
        ['Email address', client.email],
        ['Phone number', `${client.dialPrefix} ${client.phoneNumber}`],
      ],
    },
    {
      title: 'Review details',
      fields: [
        ['Officer internal ID', session.officerId],
        ['Officer comment', client.officerComment || 'No comment'],
      ],
    },
  ]

  return (
    <section className="risk-review">
      <div className="risk-intro">
        <div className="section-icon officer-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" />
            <path d="M12 8v4M12 15.5h.01" />
          </svg>
        </div>
        <div>
          <h2>Risk review</h2>
          <p>Review the client information and retrieve the calculated score.</p>
        </div>
      </div>

      <div className="risk-summary-grid">
        {summaryGroups.map((group) => (
          <section className="risk-summary-card" key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.fields.map(([label, value]) => (
                <div className="risk-summary-item" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="risk-result-card" aria-live="polite">
        <div className="risk-result-heading">
          <div>
            <span className="result-label">RISK ASSESSMENT</span>
            <h3>Calculated client score</h3>
          </div>
          {evaluation?.overrideReason && (
            <div className="red-flag-banner" role="alert">
              {evaluation.tier === 'High Risk' ? 'AUTOMATIC HIGH RISK OVERRIDE: ' : 'MANUAL REVIEW REQUIRED: '}
              {evaluation.overrideReason}
            </div>
          )}
          <div className="risk-result-symbol" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-7" />
            </svg>
          </div>
        </div>
        {loading && (
          <p className="risk-score-status" role="status">
            Retrieving score from the backend…
          </p>
        )}
        {error && (
          <div className="risk-score-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="retry-button"
              onClick={() => setRetry((attempt) => attempt + 1)}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        )}
        {evaluation && !loading && (
          <>
            {evaluation.preliminary && (
              <div className="data-view-alert" role="status">
                <strong>Preliminary assessment</strong>
                <span>The scoring service is unavailable. Cached rules were used; the saved record will remain preliminary.</span>
              </div>
            )}
            <p className="risk-score-value">
              {evaluation.score === null ? 'Unavailable' : formatScore(evaluation.score)} <span>/ 5</span>
            </p>
            <p className="risk-score-tier">{evaluation.tier}</p>
            <p className="risk-score-status">
              Weight version: {evaluation.weightVersion}
              {` · Rules: ${evaluation.scoringRuleVersion}`}
              {evaluation.overrideReason && ` · Override: ${evaluation.overrideReason}`}
            </p>
            <div className="risk-preview-table-wrap">
              <table className="risk-preview-table">
                <thead>
                  <tr>
                    <th>Risk factor</th>
                    <th>Selected value</th>
                    <th>Weight</th>
                    <th>Risk value</th>
                    <th>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.factors.map((factor) => (
                    <tr key={factor.label}>
                      <td>{factor.label}</td>
                      <td>{factor.value}</td>
                      <td>{factor.weight}</td>
                      <td>{factor.score ?? 'CPI unavailable'}</td>
                      <td>{factor.contribution?.toFixed(2) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="risk-score-status">
              Score and risk-tier classification supplied by the backend using {evaluation.preliminary ? 'cached rules' : 'the scoring service'}.
            </p>
          </>
        )}
      </section>

      {evaluation && (
        <section className="data-view-card weight-editor" aria-labelledby="screening-title">
          <div className="weight-editor-heading">
            <div>
              <h3 id="screening-title">OpenSanctions screening</h3>
              <p>Compare the watchlist evidence with the client details before confirming a match.</p>
            </div>
          </div>
          {!evaluation.screening.available ? (
            <div className="data-view-alert" role="status">
              <strong>Screening unavailable</strong>
              <span>Check that the watchlist has been imported, then try again.</span>
              <button type="button" className="retry-button" onClick={() => setRetry((attempt) => attempt + 1)}>
                Retry screening
              </button>
            </div>
          ) : evaluation.screening.candidates.length === 0 ? (
            <p className="data-view-note">The watchlist returned no name or alias match.</p>
          ) : (
            <div className="data-table-scroll">
              <table className="saved-risk-values">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Date of birth</th>
                    <th scope="col">Nationality and country</th>
                    <th scope="col">Roles</th>
                    <th scope="col">Match decision</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.screening.candidates.map((candidate) => (
                    <tr key={candidate.entityId}>
                      <th scope="row">
                        <strong>{candidate.name}</strong>
                        <div>{candidate.entityId}</div>
                        {candidate.sources.length > 0 && <div>{candidate.sources.join(', ')}</div>}
                      </th>
                      <td>{candidate.birthDates.join(', ') || 'Unknown'}</td>
                      <td>
                        Nationality: {candidate.nationalities.join(', ') || 'Unknown'}
                        <br />
                        Country: {candidate.countries.join(', ') || 'Unknown'}
                      </td>
                      <td>
                        {candidate.roles.map(({ role, redFlag }) => (
                          <div key={role}>{role} ({redFlag === true ? 'Red flag' : redFlag === false ? 'Manual review' : 'Unclassified'})</div>
                        ))}
                      </td>
                      <td>
                        <label className="client-filter">
                          <span className="sr-only">Match decision for {candidate.name}</span>
                          <select
                            value={candidate.decision ?? ''}
                            disabled={loading || decisionLoading}
                            onChange={(event) => {
                              const decision = event.target.value
                              setDecisionError('')
                              setScreeningDecisions((current) => {
                                const next = { ...current }
                                if (decision === 'confirmed' || decision === 'dismissed') {
                                  next[candidate.entityId] = decision
                                } else {
                                  delete next[candidate.entityId]
                                }
                                return next
                              })
                            }}
                          >
                            <option value="">Needs review</option>
                            <option value="confirmed">Confirm identity</option>
                            <option value="dismissed">Dismiss match</option>
                          </select>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="decision-panel" aria-labelledby="decision-title">
        <div>
          <span className="data-view-eyebrow">FINAL WORKFLOW ACTION</span>
          <h3 id="decision-title">Record decision</h3>
          <p>Client data is saved only when a final decision is submitted.</p>
        </div>
        {decisionError && <p className="decision-error" role="alert">{decisionError}</p>}
        {decisionError && (
          <button
            type="button"
            className="retry-button"
            disabled={loading || decisionLoading}
            onClick={() => {
              setDecisionError('')
              setRetry((attempt) => attempt + 1)
            }}
          >
            Refresh risk assessment
          </button>
        )}
        <div className="decision-actions">
          <button
            type="button"
            className="decision-button approve"
            disabled={!evaluation || evaluation.tier !== 'Low Risk' || screeningPending || decisionLoading}
            onClick={() => void submitDecision('approve')}
          >
            Approve
          </button>
          <button
            type="button"
            className="decision-button manual-review"
            disabled={!evaluation || evaluation.tier !== 'Medium Risk' || screeningPending || decisionLoading}
            onClick={() => void submitDecision('manual_review')}
          >
            Submit for Manual Review
          </button>
          <button
            type="button"
            className="decision-button decline"
            disabled={!evaluation || evaluation.tier !== 'High Risk' || decisionLoading}
            onClick={() => void submitDecision('decline')}
          >
            Decline / Rejection
          </button>
        </div>
      </section>

      <footer className="form-footer">
        <button type="button" className="button-secondary" onClick={onBack}>
          ← Back to client details
        </button>
      </footer>
    </section>
  )
}
