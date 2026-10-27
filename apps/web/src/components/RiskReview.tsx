import { useEffect, useState } from 'react'
import type { ClientForm } from '../form/types'

type RiskReviewProps = {
  client: ClientForm
  onBack: () => void
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

export function RiskReview({ client, onBack }: RiskReviewProps) {
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadScore() {
      setLoading(true)
      setError('')
      setScore(null)

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
            ? payload
            : payload !== null &&
                typeof payload === 'object' &&
                'score' in payload &&
                typeof payload.score === 'number'
              ? payload.score
              : null

        if (result === null || !Number.isFinite(result)) {
          throw new Error('The backend returned an invalid risk score.')
        }

        setScore(result)
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

  const summaryGroups = [
    {
      title: 'Client profile',
      fields: [
        ['Full legal name', client.clientName],
        ['Existing client ID', client.clientId || 'New client'],
        ['Date of birth', client.dateOfBirth],
        ['Nationality', client.nationality],
        ['ID issuing country', client.idIssuingCountry],
        ['Marital status', client.maritalStatus],
      ],
    },
    {
      title: 'Residence & financial profile',
      fields: [
        ['Country of residence', client.countryOfResidence],
        ['Tax domicile', client.taxDomicile],
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
        {score !== null && !loading && (
          <>
            <p className="risk-score-value">
              {formatScore(score)} <span>/ 5</span>
            </p>
            <p className="risk-score-status">
              Score supplied by the backend. Apply your organization’s policy
              when interpreting it.
            </p>
          </>
        )}
      </section>

      <footer className="form-footer">
        <button type="button" className="button-secondary" onClick={onBack}>
          ← Back to client details
        </button>
      </footer>
    </section>
  )
}
