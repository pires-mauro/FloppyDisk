import { incomeOptions, professionOptions } from '../form/options'
import type { Country, ClientForm, FieldErrors } from '../form/types'
import { CountrySelectField } from './CountrySelectField'
import { FormField } from './FormField'
import { FormSection } from './FormSection'

type FinancialSectionProps = {
  form: ClientForm
  errors: FieldErrors
  countries: Country[]
  countriesLoading: boolean
  onChange: (field: keyof ClientForm, value: string) => void
}

export function FinancialSection({
  form,
  errors,
  countries,
  countriesLoading,
  onChange,
}: FinancialSectionProps) {
  return (
    <FormSection
      number="02"
      title="Residence & financial profile"
      description="Jurisdiction and source-of-funds indicators"
      iconClassName="location-icon"
      icon={
        <svg viewBox="0 0 24 24">
          <path d="M19 10.2c0 5-7 10.2-7 10.2S5 15.2 5 10.2a7 7 0 1 1 14 0Z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      }
    >
      <CountrySelectField
        id="countryOfResidence"
        label="Country of residence"
        value={form.countryOfResidence}
        countries={countries}
        loading={countriesLoading}
        error={errors.countryOfResidence}
        onChange={(value) => onChange('countryOfResidence', value)}
      />
      <CountrySelectField
        id="taxDomicile"
        label="Tax domicile"
        value={form.taxDomicile}
        countries={countries}
        loading={countriesLoading}
        error={errors.taxDomicile}
        onChange={(value) => onChange('taxDomicile', value)}
      />
      <FormField
        id="annualIncome"
        label="Annual income"
        required
        error={errors.annualIncome}
      >
        <select
          id="annualIncome"
          name="annualIncome"
          value={form.annualIncome}
          onChange={(event) => onChange('annualIncome', event.target.value)}
          aria-invalid={Boolean(errors.annualIncome)}
        >
          <option value="">Select income range</option>
          {incomeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </FormField>
      <FormField
        id="profession"
        label="Profession / activity"
        required
        error={errors.profession}
      >
        <select
          id="profession"
          name="profession"
          value={form.profession}
          onChange={(event) => onChange('profession', event.target.value)}
          aria-invalid={Boolean(errors.profession)}
        >
          <option value="">Select activity</option>
          {professionOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </FormField>
    </FormSection>
  )
}
