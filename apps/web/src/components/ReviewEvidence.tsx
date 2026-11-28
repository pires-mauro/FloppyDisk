import type { MatchDecision, RiskFactorResult, ScreeningCandidate } from '../form/reviewEvidence'

export function RiskFactorTable({ factors }: { factors: RiskFactorResult[] }) {
  return (
    <div className="risk-preview-table-wrap">
      <table className="risk-preview-table">
        <thead>
          <tr>
            <th scope="col">Risk factor</th>
            <th scope="col">Selected value</th>
            <th scope="col">Weight</th>
            <th scope="col">Risk value</th>
            <th scope="col">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((factor) => (
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
  )
}

export function ScreeningCandidatesTable({ candidates, onDecisionChange, disabled }: {
  candidates: ScreeningCandidate[]
  onDecisionChange?: (entityId: string, decision: MatchDecision | '') => void
  disabled?: boolean
}) {
  return (
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
          {candidates.map((candidate) => (
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
                {onDecisionChange ? (
                  <label className="client-filter">
                    <span className="sr-only">Match decision for {candidate.name}</span>
                    <select
                      value={candidate.decision ?? ''}
                      disabled={disabled}
                      onChange={(event) => {
                        const value = event.target.value
                        onDecisionChange(candidate.entityId, value === 'confirmed' || value === 'dismissed' ? value : '')
                      }}
                    >
                      <option value="">Needs review</option>
                      <option value="confirmed">Confirm identity</option>
                      <option value="dismissed">Dismiss match</option>
                    </select>
                  </label>
                ) : candidate.decision === 'confirmed' ? 'Confirmed' :
                  candidate.decision === 'dismissed' ? 'Dismissed' : 'Unresolved'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
