import { useState, type FormEvent } from 'react'

export function ManualReviewDecision({ clientId, clientName, onSaved, onCancel }: {
  clientId: string
  clientName: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [officerId, setOfficerId] = useState('')
  const [officerPassword, setOfficerPassword] = useState('')
  const [officerComment, setOfficerComment] = useState('')
  const [decision, setDecision] = useState<'approve' | 'decline'>('approve')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
      const response = await fetch(`${apiUrl}/v1/clients/${encodeURIComponent(clientId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId, officerPassword, officerComment, finalDecision: decision }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const detail = payload !== null && typeof payload === 'object' &&
          'detail' in payload && typeof payload.detail === 'string' ? payload.detail : null
        throw new Error(detail || `Could not save the manual review (${response.status}).`)
      }
      if (payload === null || typeof payload !== 'object' || !('internal_client_id' in payload)) {
        throw new Error('The API did not confirm the saved decision.')
      }
      onSaved()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the manual review.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="risk-summary-card" onSubmit={(event) => void submit(event)}>
      <h3>Complete manual review: {clientName} (#{clientId})</h3>
      <p>Record the review outcome. The original risk score and configuration version are retained.</p>
      <fieldset disabled={saving}>
        <div className="field">
          <label className="field-label" htmlFor="manual-review-officer">Officer internal ID</label>
          <input id="manual-review-officer" required pattern="[0-9]{10}" maxLength={10}
            inputMode="numeric" value={officerId} onChange={(event) => setOfficerId(event.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="manual-review-password">Officer password</label>
          <input id="manual-review-password" type="password" autoComplete="current-password"
            required maxLength={1024} value={officerPassword}
            onChange={(event) => setOfficerPassword(event.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="manual-review-comment">Review comment</label>
          <textarea id="manual-review-comment" maxLength={500} value={officerComment}
            onChange={(event) => setOfficerComment(event.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="manual-review-outcome">Review outcome</label>
          <select id="manual-review-outcome" value={decision}
            onChange={(event) => setDecision(event.target.value as 'approve' | 'decline')}>
            <option value="approve">Approve</option>
            <option value="decline">Decline / Rejection</option>
          </select>
        </div>
        {error && <p className="decision-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button-secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="button-primary" type="submit">{saving ? 'Saving…' : 'Save review outcome'}</button>
        </div>
      </fieldset>
    </form>
  )
}
