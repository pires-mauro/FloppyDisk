import { useEffect, useState } from 'react'
import type { ClientForm, Country } from '../form/types'

type RiskReviewProps = {
  client: ClientForm
  countries: Country[]
  onBack: () => void
}

type RiskTier = 'Low Risk' | 'Medium Risk' | 'High Risk'

type RiskFactorResult = {
  label: string
  value: string
  weight: number
  score: number
  contribution: number
}

type Evaluation = {
  score: number
  tier: RiskTier
  weightVersion: number | string
  overrideReason: string | null
  factors: RiskFactorResult[]
}

function formatScore(score: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(score)
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

  return `Risk score request failed (${response.status}).`
}

export function RiskReview({ client, countries, onBack }: RiskReviewProps) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [decisionComplete, setDecisionComplete] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadScore() {
      setLoading(true)
      setError('')
      setEvaluation(null)

      try {
        const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
        const response = await fetch(`${apiUrl}/v1/risk/evaluation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(client),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(await getErrorMessage(response))
        }

        const payload: unknown = await response.json()
        const result =
          typeof payload === 'number'
            ? {
                score: payload,
                tier: null,
                weightVersion: null,
                overrideReason: null,
                factors: [],
              }
            : payload !== null && typeof payload === 'object'
              ? payload
              : null
        if (
          !result ||
          !('score' in result) ||
          typeof result.score !== 'number' ||
          !Number.isFinite(result.score)
        ) {
          throw new Error('The backend returned an invalid risk score.')
        }

        const score = result.score
        const tier =
          'tier' in result && (result.tier === 'Low Risk' ||
            result.tier === 'Medium Risk' ||
            result.tier === 'High Risk')
            ? result.tier
            : score < 2.5
              ? 'Low Risk'
              : score < 3.75
                ? 'Medium Risk'
                : 'High Risk'
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
                  typeof factor.score === 'number' &&
                  'contribution' in factor &&
                  typeof factor.contribution === 'number',
              )
            : []
        setEvaluation({
          score,
          tier: client.pepConfirmed || client.sanctionsMatch ? 'High Risk' : tier,
          weightVersion:
            'weightVersion' in result &&
            (typeof result.weightVersion === 'string' ||
              typeof result.weightVersion === 'number')
              ? result.weightVersion
              : '—',
          overrideReason:
            client.pepConfirmed || client.sanctionsMatch
              ? [
                  client.sanctionsMatch && 'Sanctions',
                  client.pepConfirmed && 'PEP',
                ].filter(Boolean).join(' / ')
              : 'overrideReason' in result &&
                  typeof result.overrideReason === 'string'
                ? result.overrideReason
                : null,
          factors,
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
  }, [client, retry])

  async function submitDecision(decision: 'approve' | 'manual_review' | 'decline') {
    if (!evaluation) return
    setDecisionLoading(true)
    setDecisionError('')
    setDecisionComplete('')
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
      const response = await fetch(`${apiUrl}/v1/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...client,
          riskScore: evaluation.score,
          riskTier: evaluation.tier,
          finalDecision: decision,
          weightVersion: evaluation.weightVersion,
        }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const payload: unknown = await response.json()
      if (
        payload === null ||
        typeof payload !== 'object' ||
        !('internal_client_id' in payload)
      ) {
        throw new Error('The API did not confirm a saved client record.')
      }
      setDecisionComplete('Decision saved and client record created.')
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
      title: 'Officer details',
      fields: [
        ['Officer internal ID', client.officerId],
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
          {(client.pepConfirmed || client.sanctionsMatch) && (
            <div className="red-flag-banner" role="alert">
              AUTOMATIC HIGH RISK OVERRIDE: {[
                client.sanctionsMatch && 'Sanctions',
                client.pepConfirmed && 'PEP',
              ].filter(Boolean).join(' / ')} Hit Detected
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
            <p className="risk-score-value">
              {formatScore(evaluation.score)} <span>/ 5</span>
            </p>
            <p className="risk-score-tier">{evaluation.tier}</p>
            <p className="risk-score-status">
              Weight version: {evaluation.weightVersion}
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
                      <td>{factor.score}</td>
                      <td>{factor.contribution.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="risk-score-status">
              Score and risk-tier classification supplied by the backend.
            </p>
          </>
        )}
      </section>

      <section className="decision-panel" aria-labelledby="decision-title">
        <div>
          <span className="data-view-eyebrow">FINAL WORKFLOW ACTION</span>
          <h3 id="decision-title">Record decision</h3>
          <p>Client data is saved only when a final decision is submitted.</p>
        </div>
        {decisionError && <p className="decision-error" role="alert">{decisionError}</p>}
        {decisionComplete && <p className="decision-success" role="status">{decisionComplete}</p>}
        <div className="decision-actions">
          <button
            type="button"
            className="decision-button approve"
            disabled={!evaluation || evaluation.tier !== 'Low Risk' || decisionLoading}
            onClick={() => void submitDecision('approve')}
          >
            Approve
          </button>
          <button
            type="button"
            className="decision-button manual-review"
            disabled={!evaluation || evaluation.tier !== 'Medium Risk' || decisionLoading}
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
