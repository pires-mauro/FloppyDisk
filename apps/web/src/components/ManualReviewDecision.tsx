import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatScore, isRecord, isRiskFactor, isScreening, isStringList } from '../form/reviewEvidence'
import type { RiskFactorResult, Screening } from '../form/reviewEvidence'
import type { OfficerSession } from './OfficerLogin'
import { RiskFactorTable, ScreeningCandidatesTable } from './ReviewEvidence'

const identityFields = [
  ['name', 'Full legal name'],
  ['documentNumber', 'Identity document number'],
  ['issuingCountry', 'Issuing country'],
  ['dateOfBirth', 'Date of birth'],
  ['nationality', 'Nationality'],
  ['maritalStatus', 'Marital status'],
] as const

const financialFields = [
  ['countryOfResidence', 'Country of residence'],
  ['taxDomicile', 'Tax domicile'],
  ['income', 'Annual income'],
  ['profession', 'Professional activity'],
  ['email', 'Email'],
  ['phone', 'Phone'],
] as const

type ProfileField = (typeof identityFields | typeof financialFields)[number][0]
type SavedProfile = Record<ProfileField, string> & {
  address: { street: string; city: string; houseNumber: string | null; postalCode: string | null }
}

type SavedReview = {
  assessmentId: number
  profile: SavedProfile
  decision: string
  tier: string
  score: number | null
  preliminary: boolean
  weightVersion: number
  scoringRuleVersion: string | null
  reviewReason: string | null
  evaluatedAt: string
  officerId: string
  officerName: string
  officerComment: string | null
  factors: RiskFactorResult[]
  screening: Screening | null
  savedRoles: string[]
}

function isSavedReview(value: unknown): value is SavedReview {
  if (!isRecord(value) || !isRecord(value.profile)) return false
  const profile = value.profile
  const address = profile.address
  return [...identityFields, ...financialFields].every(([key]) => typeof profile[key] === 'string') &&
    isRecord(address) && typeof address.street === 'string' && typeof address.city === 'string' &&
    (typeof address.houseNumber === 'string' || address.houseNumber === null) &&
    (typeof address.postalCode === 'string' || address.postalCode === null) &&
    typeof value.assessmentId === 'number' && typeof value.decision === 'string' &&
    typeof value.tier === 'string' && (typeof value.score === 'number' || value.score === null) &&
    typeof value.preliminary === 'boolean' && typeof value.weightVersion === 'number' &&
    (typeof value.scoringRuleVersion === 'string' || value.scoringRuleVersion === null) &&
    (typeof value.reviewReason === 'string' || value.reviewReason === null) &&
    typeof value.evaluatedAt === 'string' && typeof value.officerId === 'string' &&
    typeof value.officerName === 'string' && (typeof value.officerComment === 'string' || value.officerComment === null) &&
    Array.isArray(value.factors) && value.factors.every(isRiskFactor) &&
    (value.screening === null || isScreening(value.screening)) && isStringList(value.savedRoles)
}

function ReviewSummary({ title, fields }: { title: string; fields: ReadonlyArray<readonly [string, string]> }) {
  return (
    <section className="risk-summary-card">
      <h3>{title}</h3>
      <dl>
        {fields.map(([label, value]) => (
          <div className="risk-summary-item" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

async function readReviewResponse(response: Response, errorMessage: string): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `${errorMessage} (${response.status}).`)
  }
  return payload
}

export function ManualReviewDecision({ clientId, clientName, session, onSaved, onCancel }: {
  clientId: string
  clientName: string
  session: OfficerSession
  onSaved: () => void
  onCancel: () => void
}) {
  const [details, setDetails] = useState<SavedReview | null>(null)
  const [officerComment, setOfficerComment] = useState('')
  const [decision, setDecision] = useState<'approve' | 'decline' | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
  const clientUrl = `${apiUrl}/v1/clients/${encodeURIComponent(clientId)}`

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')
      setDetails(null)
      setDecision('')
      try {
        const response = await fetch(`${clientUrl}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ officerId: session.officerId, officerPassword: session.password }),
          signal: controller.signal,
        })
        const result = await readReviewResponse(response, 'Could not load the saved review')
        if (!isSavedReview(result)) throw new Error('The API returned an invalid saved review.')
        if (!controller.signal.aborted) setDetails(result)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the saved review.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [clientUrl, retry, session.officerId, session.password])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!details || details.decision !== 'manual_review' || !decision || loading || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${clientUrl}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officerId: session.officerId,
          officerPassword: session.password,
          officerComment,
          finalDecision: decision,
          assessmentId: details.assessmentId,
        }),
      })
      if (response.status === 409) setDetails(null)
      const result = await readReviewResponse(response, 'Could not save the review outcome')
      if (!isRecord(result) || String(result.internal_client_id) !== clientId) {
        throw new Error('The API did not confirm the saved decision.')
      }
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the review outcome.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="risk-review manual-review" aria-labelledby="manual-review-title">
      <header className="risk-intro manual-review-header">
        <h2 id="manual-review-title" tabIndex={-1} ref={titleRef}>
          Complete manual review: {details?.profile.name ?? clientName} (#{clientId})
        </h2>
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Close review</button>
      </header>
      {loading && <p className="data-view-note" role="status">Loading saved client and assessment details…</p>}
      {error && (
        <div className="data-view-alert" role="alert">
          <span>{error}</span>
          {!details && !loading && (
            <button type="button" className="retry-button" onClick={() => setRetry((attempt) => attempt + 1)}>
              Reload review details
            </button>
          )}
        </div>
      )}

      {details && (
        <>
          <div className="risk-summary-grid">
            <ReviewSummary title="Saved client profile" fields={identityFields.map(([key, label]) =>
              [label, details.profile[key]],
            )} />
            <ReviewSummary title="Contact and financial details" fields={[
              ['Address', [details.profile.address.street, details.profile.address.houseNumber,
                details.profile.address.postalCode, details.profile.address.city].filter(Boolean).join(', ')],
              ...financialFields.map(([key, label]) => [label, details.profile[key]] as const),
            ]} />
          </div>

          <section className="risk-result-card" aria-labelledby="saved-risk-title">
            <div className="risk-result-heading"><h3 id="saved-risk-title">Saved risk assessment</h3></div>
            <p className="risk-score-status">
              {details.tier} · {details.score === null ? 'Score unavailable' : `${formatScore(details.score)} / 5`}
              {' · '}{details.preliminary ? 'Preliminary' : 'Confirmed'} · Weight version {details.weightVersion}
              {details.scoringRuleVersion && ` · Rules: ${details.scoringRuleVersion}`}
            </p>
            <p className="risk-score-status">
              {details.officerName} ({details.officerId}) · {new Date(details.evaluatedAt).toLocaleString()}
            </p>
            <p><strong>Review reason</strong> {details.reviewReason ?? 'No review reason was saved.'}</p>
            <p><strong>Officer comment</strong> {details.officerComment ?? 'No comment was saved.'}</p>
            {details.factors.length ? <RiskFactorTable factors={details.factors} /> :
              <p className="data-view-note">No factor breakdown was saved for this assessment.</p>}
          </section>

          <section className="risk-summary-card" aria-labelledby="saved-screening-title">
            <h3 id="saved-screening-title">Saved OpenSanctions evidence</h3>
            {details.savedRoles.length > 0 && (
              <p className="risk-score-status">Saved matched roles: {details.savedRoles.join(', ')}</p>
            )}
            {details.screening === null ? <p className="risk-score-status">No screening evidence was saved.</p> :
              !details.screening.available ? <p className="risk-score-status">Screening was unavailable for this assessment.</p> :
                details.screening.candidates.length === 0 ? <p className="risk-score-status">No watchlist candidates were recorded.</p> :
                  <ScreeningCandidatesTable candidates={details.screening.candidates} />}
          </section>

          {details.decision === 'manual_review' ? (
            <form className="decision-panel" onSubmit={(event) => void submit(event)}>
              <h3>Record review outcome</h3>
              <fieldset disabled={saving}>
                <div className="field">
                  <label className="field-label" htmlFor="manual-review-comment">Review comment</label>
                  <textarea id="manual-review-comment" maxLength={500} value={officerComment}
                    onChange={(event) => setOfficerComment(event.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="manual-review-outcome">Review outcome</label>
                  <select id="manual-review-outcome" required value={decision}
                    onChange={(event) => {
                      const value = event.target.value
                      setDecision(value === 'approve' || value === 'decline' ? value : '')
                    }}>
                    <option value="">Select an outcome</option>
                    <option value="approve">Approve</option>
                    <option value="decline">Decline / Rejection</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="button-primary" type="submit" disabled={saving || !decision}>
                    {saving ? 'Saving…' : 'Save review outcome'}
                  </button>
                </div>
              </fieldset>
            </form>
          ) : <p className="data-view-note" role="status">This client is no longer awaiting manual review.</p>}
        </>
      )}
    </section>
  )
}
