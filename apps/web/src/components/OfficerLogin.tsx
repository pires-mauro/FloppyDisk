import { useState, type FormEvent } from 'react'

export type OfficerSession = {
  officerId: string
  password: string
  isAdmin: boolean
}

export function OfficerLogin({
  onLogin,
}: {
  onLogin: (session: OfficerSession) => void
}) {
  const [officerId, setOfficerId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
      const response = await fetch(`${apiUrl}/v1/officers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId, officerPassword: password }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const detail = payload !== null && typeof payload === 'object' &&
          'detail' in payload && typeof payload.detail === 'string'
          ? payload.detail
          : `Sign-in failed (${response.status}).`
        throw new Error(response.status === 401
          ? 'Officer ID or password is incorrect.'
          : detail)
      }
      if (
        payload === null ||
        typeof payload !== 'object' ||
        !('officerId' in payload) ||
        typeof payload.officerId !== 'string' ||
        !('isAdmin' in payload) ||
        typeof payload.isAdmin !== 'boolean'
      ) {
        throw new Error('The sign-in response was invalid.')
      }

      onLogin({
        officerId: payload.officerId,
        password,
        isAdmin: payload.isAdmin,
      })
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not sign in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <a className="brand login-brand" href="/" aria-label="FloppyDisk home">
        <img
          className="brand-logo"
          src="/Gemini_Generated_Image_wbum4wwbum4wwbum.jfif"
          alt="FloppyDisk"
        />
      </a>
      <section className="login-card" aria-labelledby="login-title">
        <span className="data-view-eyebrow">OFFICER ACCESS</span>
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in once to access client onboarding and review tools.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span className="field-label">Officer internal ID</span>
            <input
              autoComplete="username"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              value={officerId}
              onChange={(event) =>
                setOfficerId(event.target.value.replace(/\D/g, '').slice(0, 10))
              }
              placeholder="10-digit officer ID"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              autoComplete="current-password"
              type="password"
              maxLength={1024}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button-primary login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-note">Your sign-in lasts until you log out or close/reload this page.</p>
      </section>
    </main>
  )
}
