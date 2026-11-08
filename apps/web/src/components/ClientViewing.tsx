import { useEffect, useMemo, useState } from 'react'

const clientColumns = [
  ['internal_client_id', 'Internal client ID'],
  ['client_name', 'Client name'],
  ['issuing_country', 'Issuing country'],
  ['risk_tier', 'Risk tier'],
  ['final_decision', 'Final decision'],
  ['officer_id', 'Officer ID'],
  ['submission_date', 'Submission date'],
] as const

type ClientRecord = Partial<Record<(typeof clientColumns)[number][0], string>>

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
}

function getStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function parseClients(payload: unknown): ClientRecord[] {
  const records =
    Array.isArray(payload)
      ? payload
      : payload !== null &&
          typeof payload === 'object' &&
          'clients' in payload &&
          Array.isArray(payload.clients)
        ? payload.clients
        : null

  if (!records || records.some((record) => record === null || typeof record !== 'object')) {
    throw new Error('The client list endpoint returned an invalid response.')
  }

  return records.map((record) => {
    const fields = record as Record<string, unknown>
    return Object.fromEntries(
      clientColumns.map(([key]) => [key, getStringField(fields, key)]),
    ) as ClientRecord
  })
}

export function ClientViewing() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [sortField, setSortField] = useState<'internal_client_id' | 'risk_tier'>(
    'internal_client_id',
  )
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('ascending')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadClients() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`${getApiUrl()}/v1/clients`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Client list request failed (${response.status}).`)
        }

        setClients(parseClients(await response.json()))
      } catch (requestError) {
        if (controller.signal.aborted) return
        setClients([])
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load client records.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadClients()
    return () => controller.abort()
  }, [retry])

  const visibleClients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return clients
      .filter((client) =>
        !query ||
        Object.values(client).some((value) =>
          value?.toLocaleLowerCase().includes(query),
        ),
      )
      .filter((client) => !tierFilter || client.risk_tier === tierFilter)
      .sort((left, right) => {
        const comparison = (left[sortField] || '').localeCompare(
          right[sortField] || '',
          undefined,
          { numeric: true, sensitivity: 'base' },
        )
        return sortOrder === 'ascending' ? comparison : -comparison
      })
  }, [clients, search, tierFilter, sortField, sortOrder])

  return (
    <section className="data-view" aria-labelledby="client-view-title">
      <div className="data-view-heading">
        <div>
          <span className="data-view-eyebrow">CLIENT RECORDS</span>
          <h2 id="client-view-title">Client viewing</h2>
          <p>Review submitted onboarding records and their decisions.</p>
        </div>
        <span className="data-view-count">
          {loading ? 'Loading…' : `${clients.length} ${clients.length === 1 ? 'record' : 'records'}`}
        </span>
      </div>

      <div className="data-view-card">
        <div className="data-view-toolbar">
          <label className="data-search">
            <span className="sr-only">Search client records</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.3" />
              <path d="m15.5 15.5 4.2 4.2" />
            </svg>
            <input
              type="search"
              placeholder="Search client records"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="client-filter">
            Risk tier
            <select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value)}
            >
              <option value="">All tiers</option>
              <option value="Low Risk">Low Risk</option>
              <option value="Medium Risk">Medium Risk</option>
              <option value="High Risk">High Risk</option>
            </select>
          </label>
          <label className="client-filter">
            Sort by
            <select
              value={sortField}
              onChange={(event) =>
                setSortField(event.target.value as typeof sortField)
              }
            >
              <option value="internal_client_id">Client ID</option>
              <option value="risk_tier">Risk tier</option>
            </select>
          </label>
          <label className="client-filter">
            Order
            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as typeof sortOrder)
              }
            >
              <option value="ascending">Ascending</option>
              <option value="descending">Descending</option>
            </select>
          </label>
          <button
            type="button"
            className="retry-button"
            onClick={() => setRetry((attempt) => attempt + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {error && (
          <div className="data-view-alert" role="alert">
            <strong>Could not load client records</strong>
            <span>{error} The client-list endpoint may not be implemented yet.</span>
          </div>
        )}
        <div className="data-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {clientColumns.map(([, label]) => (
                  <th key={label} scope="col">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && !error && visibleClients.length > 0 &&
                visibleClients.map((client, index) => (
                  <tr key={client.internal_client_id || index}>
                    {clientColumns.map(([key]) => (
                      <td key={key}>{client[key] || '—'}</td>
                    ))}
                  </tr>
                ))}
              {!loading && !error && visibleClients.length === 0 && (
                <tr>
                  <td className="data-table-empty" colSpan={clientColumns.length}>
                    <strong>
                      {clients.length ? 'No matching client records' : 'No client records to display'}
                    </strong>
                    <span>
                      {clients.length
                        ? 'Try another search.'
                        : 'Submitted clients will appear here when records are available.'}
                    </span>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="data-table-empty" colSpan={clientColumns.length}>
                    <span role="status">Loading client records…</span>
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="data-table-empty" colSpan={clientColumns.length}>
                    <strong>Client records are unavailable</strong>
                    <span>The table will populate when the API is ready.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="data-view-note">
          Search filters the records returned by the client-list API.
        </p>
      </div>
    </section>
  )
}
