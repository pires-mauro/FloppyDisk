import { useEffect, useState, type FormEvent } from 'react'
import { ClientProfileSection } from './components/ClientProfileSection'
import { ContactSection } from './components/ContactSection'
import { FinancialSection } from './components/FinancialSection'
import { OfficerSection } from './components/OfficerSection'
import { RiskReview } from './components/RiskReview'
import { testCountries } from './form/options'
import { initialForm, type ClientForm, type Country } from './form/types'
import { validateForm } from './form/validation'
import './App.css'

function App() {
  const [form, setForm] = useState(initialForm)
  const [countries, setCountries] = useState<Country[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [countriesError, setCountriesError] = useState('')
  const [countriesRetry, setCountriesRetry] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState<'details' | 'risk'>('details')
  const errors = submitted ? validateForm(form) : {}
  const errorCount = Object.keys(errors).length

  useEffect(() => {
    const controller = new AbortController()
    const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

    async function loadCountries() {
      setCountriesLoading(true)
      setCountriesError('')

      try {
        const response = await fetch(`${apiUrl}/countries`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Countries request failed (${response.status}).`)
        }

        const payload: unknown = await response.json()
        const items =
          Array.isArray(payload)
            ? payload
            : payload !== null &&
                typeof payload === 'object' &&
                'countries' in payload &&
                Array.isArray(payload.countries)
              ? payload.countries
              : null

        if (!items) {
          throw new Error('The countries endpoint returned an invalid response.')
        }

        const loadedCountries = items.map((item): Country => {
          if (
            item !== null &&
            typeof item === 'object' &&
            'code' in item &&
            typeof item.code === 'string' &&
            'name' in item &&
            typeof item.name === 'string'
          ) {
            return { code: item.code, name: item.name }
          }
          if (typeof item === 'string') {
            return { code: item, name: item }
          }
          throw new Error('The countries endpoint returned an invalid country.')
        })

        if (loadedCountries.length === 0) {
          throw new Error('The countries endpoint returned no countries.')
        }

        setCountries(
          loadedCountries.sort((a, b) => a.name.localeCompare(b.name)),
        )
      } catch (error) {
        if (controller.signal.aborted) return
        setCountries(testCountries)
        setCountriesError(
          error instanceof Error
            ? error.message
            : 'Could not load countries. Please try again.',
        )
      } finally {
        if (!controller.signal.aborted) setCountriesLoading(false)
      }
    }

    void loadCountries()
    return () => controller.abort()
  }, [countriesRetry])

  function updateField(field: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const validationErrors = validateForm(form)
    if (Object.keys(validationErrors).length > 0) {
      const firstInvalidField = Object.keys(validationErrors)[0]
      document.getElementById(firstInvalidField)?.focus()
      return
    }

    setStep('risk')
  }

  function handleReset() {
    setForm(initialForm)
    setSubmitted(false)
    setStep('details')
  }

  const isRiskStep = step === 'risk'

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FloppyDisk home">
          <img
            className="brand-logo"
            src="/Gemini_Generated_Image_wbum4wwbum4wwbum.jfif"
            alt="FloppyDisk"
          />
        </a>
        <div className="secure-label">
          <span className="secure-dot" /> Secure client onboarding
        </div>
      </header>

      <section className="intro">
        <div className="eyebrow">
          <span className="eyebrow-line" /> CLIENT SERVICES
        </div>
        <h1>New client <span>onboarding</span></h1>
        <p>Capture verified client details to begin a compliant onboarding review.</p>
        <div
          className="progress-row"
          aria-label={`Step ${isRiskStep ? '2' : '1'} of 3: ${isRiskStep ? 'Risk review' : 'Client details'}`}
        >
          <div className="progress-steps">
            <span className={`progress-step${isRiskStep ? ' complete' : ' active'}`}><span>{isRiskStep ? '✓' : '1'}</span> Client details</span>
            <i />
            <span className={`progress-step${isRiskStep ? ' active' : ''}`}><span>2</span> Risk review</span>
            <i />
            <span className="progress-step"><span>3</span> Decision</span>
          </div>
          <span className="step-count">STEP {isRiskStep ? '02' : '01'} <b>/ 03</b></span>
        </div>
      </section>

      {!isRiskStep && <form className="onboarding-form" noValidate onSubmit={handleSubmit}>
        {countriesError && (
          <div className="country-fallback" role="status">
            <span className="fallback-icon" aria-hidden="true">i</span>
            <div>
              <strong>Using test countries</strong>
              <p>
                The countries endpoint is unavailable ({countriesError}).
                Luxembourg, Germany, and France are available for testing.
              </p>
              <button
                type="button"
                className="retry-button"
                onClick={() => setCountriesRetry((attempt) => attempt + 1)}
              >
                Try again
              </button>
            </div>
          </div>
        )}
        {submitted && errorCount > 0 && (
          <div className="validation-summary" role="alert" aria-live="polite">
            <span className="summary-icon">!</span>
            <div>
              <strong>Check the highlighted fields</strong>
              <p>
                {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} your
                attention before you can continue.
              </p>
            </div>
          </div>
        )}

        <ClientProfileSection
          form={form}
          errors={errors}
          countries={countries}
          countriesLoading={countriesLoading}
          onChange={updateField}
        />
        <FinancialSection
          form={form}
          errors={errors}
          countries={countries}
          countriesLoading={countriesLoading}
          onChange={updateField}
        />
        <ContactSection form={form} errors={errors} onChange={updateField} />
        <OfficerSection form={form} errors={errors} onChange={updateField} />

        <footer className="form-footer">
          <p className="required-note"><span className="required-mark">*</span> Required fields</p>
          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={handleReset}>
              Clear form
            </button>
            <button type="submit" className="button-primary">
              Continue to risk review <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </form>}
      {isRiskStep && (
        <RiskReview client={form} onBack={() => setStep('details')} />
      )}
    </main>
  )
}

export default App
