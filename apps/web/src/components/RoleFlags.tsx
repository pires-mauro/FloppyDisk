import { useEffect, useState } from 'react'
import type { OfficerSession } from './OfficerLogin'

type RoleFlag = {
  role: string
  red_flag: boolean | null
}

const roleLabels = new Map(Object.entries({
  'asset.frozen': 'Asset freeze',
  'corp.disqual': 'Corporate disqualification',
  crime: 'Crime-related listing',
  'crime.boss': 'Criminal leadership',
  'crime.cyber': 'Cybercrime',
  'crime.fin': 'Financial crime',
  'crime.fraud': 'Fraud',
  'crime.terror': 'Terrorism-related listing',
  'crime.traffick.drug': 'Drug trafficking',
  'crime.traffick.human': 'Human trafficking',
  'crime.war': 'War crimes',
  debarment: 'Public procurement exclusion',
  'export.control': 'Export controls',
  'forced.labor': 'Forced labor',
  mil: 'Military affiliation',
  poi: 'Person of interest',
  'reg.action': 'Regulatory enforcement',
  'reg.warn': 'Regulatory warning',
  'role.diplo': 'Diplomat',
  'role.judge': 'Judge',
  'role.oligarch': 'Oligarch',
  'role.pep': 'Politically exposed person',
  'role.pol': 'Politician',
  'role.rca': 'Relative or close associate of a PEP',
  sanction: 'Direct sanctions designation',
  'sanction.counter': 'Counter-sanctions designation',
  'sanction.linked': 'Linked to a sanctioned entity',
  wanted: 'Wanted by authorities',
}))

function isRoleFlag(value: unknown): value is RoleFlag {
  return value !== null && typeof value === 'object' &&
    'role' in value && typeof value.role === 'string' &&
    'red_flag' in value && (value.red_flag === null || typeof value.red_flag === 'boolean')
}

async function requestRoleFlags(
  officerId: string,
  officerPassword: string,
  { updates, signal }: { updates?: Record<string, boolean>; signal?: AbortSignal },
): Promise<RoleFlag[]> {
  const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${apiUrl}/v1/screening/roles${updates ? '' : '/list'}`, {
    method: updates ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ officerId, officerPassword, updates }),
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const detail = payload !== null && typeof payload === 'object' &&
      'detail' in payload && typeof payload.detail === 'string' ? payload.detail : null
    throw new Error(detail ?? `Role flag request failed (${response.status}).`)
  }
  if (!Array.isArray(payload) || !payload.every(isRoleFlag)) {
    throw new Error('The API returned an invalid role list.')
  }
  return payload
}

export function RoleFlags({ session: { officerId, password, isAdmin } }: { session: OfficerSession }) {
  const [roles, setRoles] = useState<RoleFlag[]>([])
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')
      try {
        const entries = await requestRoleFlags(officerId, password, { signal: controller.signal })
        if (controller.signal.aborted) return
        setRoles(entries)
        setDraft({})
        setSaved(false)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the role flags.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [officerId, password, retry])

  const changes = roles.filter(({ role, red_flag }) => draft[role] !== undefined && draft[role] !== red_flag)

  async function save() {
    if (!isAdmin || !changes.length || loading || saving) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updates = Object.fromEntries(changes.map(({ role }) => [role, draft[role]]))
      const updated = await requestRoleFlags(officerId, password, { updates })
      const updatedByRole = new Map(updated.map((entry) => [entry.role, entry]))
      setRoles((current) => current.map((entry) => updatedByRole.get(entry.role) ?? entry))
      setDraft({})
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the role flags.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="data-view" aria-labelledby="role-flags-title">
      <div className="data-view-heading">
        <div>
          <h2 id="role-flags-title">Role flags</h2>
          <p>Review OpenSanctions role settings. Only admins can change them.</p>
        </div>
      </div>

      <div className="data-view-card weight-editor">
        <div className="weight-editor-heading">
          <div>
            <h3>Screening roles</h3>
            <p>Choose whether a confirmed match should count as a red flag.</p>
          </div>
          <button type="button" className="retry-button" onClick={() => setRetry(retry + 1)} disabled={loading || saving}>
            Reload
          </button>
        </div>
        {error && <p className="data-view-alert" role="alert">{error}</p>}
        {saved && <p className="decision-success" role="status">Role flags saved.</p>}
        {loading && <p className="data-view-note" role="status">Loading role flags…</p>}
        {!loading && !error && !roles.length && <p className="data-view-note">No screening roles are available yet.</p>}

        {roles.length > 0 && (
          <div className="data-table-scroll">
            <table className="saved-risk-values role-flags-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Saved setting</th>
                  {isAdmin && <th scope="col">Change setting</th>}
                </tr>
              </thead>
              <tbody>
                {roles.map(({ role, red_flag }) => {
                  const label = roleLabels.get(role)
                  const draftFlag = draft[role] ?? red_flag
                  return (
                    <tr key={role}>
                      <th scope="row">
                        {label && <strong>{label}</strong>}
                        <code>{role}</code>
                      </th>
                      <td>
                        <span className={`client-status-badge ${red_flag === true ? 'high' : red_flag === false ? 'medium' : 'neutral'}`}>
                          {red_flag === true ? 'Red flag' : red_flag === false ? 'Manual review' : 'Unclassified'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <label className="client-filter">
                            <span className="sr-only">Change setting for {label ?? role}</span>
                            <select
                              value={draftFlag === null ? '' : String(draftFlag)}
                              disabled={loading || saving}
                              onChange={(event) => {
                                const value = event.target.value
                                setSaved(false)
                                setDraft((current) => {
                                  const next = { ...current }
                                  if (value === '') delete next[role]
                                  else next[role] = value === 'true'
                                  return next
                                })
                              }}
                            >
                              {red_flag === null && <option value="">Unclassified</option>}
                              <option value="false">Manual review</option>
                              <option value="true">Red flag</option>
                            </select>
                          </label>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin && roles.length > 0 && (
          <div className="weight-section-actions">
            <button
              type="button"
              className="button-primary weight-save-button"
              onClick={() => void save()}
              disabled={loading || saving || !changes.length}
            >
              {saving ? 'Saving…' : 'Save role flags'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
