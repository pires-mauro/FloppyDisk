import type { Country, ClientForm, FieldErrors } from '../form/types'
import { maritalStatusOptions } from '../form/options'
import { CountrySelectField } from './CountrySelectField'
import { DateOfBirthField } from './DateOfBirthField'
import { FormField } from './FormField'
import { FormSection } from './FormSection'

type ClientProfileSectionProps = {
  form: ClientForm
  errors: FieldErrors
  countries: Country[]
  countriesLoading: boolean
  onChange: (field: keyof ClientForm, value: string) => void
}

export function ClientProfileSection({
  form,
  errors,
  countries,
  countriesLoading,
  onChange,
}: ClientProfileSectionProps) {
  return (
    <FormSection
      number="01"
      title="Client profile"
      description="Personal identity and document details"
      iconClassName="profile-icon"
      icon={
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.5-3.5 3-5.5 7-5.5s6.5 2 7 5.5" />
        </svg>
      }
    >
      <FormField
        id="clientName"
        label="Full legal name"
        required
        error={errors.clientName}
        hint="As shown on the client's official ID"
      >
        <input
          id="clientName"
          name="clientName"
          type="text"
          value={form.clientName}
          onChange={(event) => onChange('clientName', event.target.value)}
          maxLength={100}
          autoComplete="name"
          placeholder="e.g. Alex Morgan"
          aria-invalid={Boolean(errors.clientName)}
          aria-describedby={
            errors.clientName ? 'clientName-error' : 'clientName-hint'
          }
        />
      </FormField>
      <FormField
        id="clientId"
        label="Existing client ID (if applicable)"
        error={errors.clientId}
        hint="Leave blank for a new client"
      >
        <input
          id="clientId"
          name="clientId"
          type="text"
          value={form.clientId}
          onChange={(event) => onChange('clientId', event.target.value)}
          maxLength={100}
          placeholder="Enter an existing client ID, if available"
          aria-invalid={Boolean(errors.clientId)}
          aria-describedby={
            errors.clientId ? 'clientId-error' : 'clientId-hint'
          }
        />
      </FormField>
      <DateOfBirthField
        value={form.dateOfBirth}
        error={errors.dateOfBirth}
        onChange={(value) => onChange('dateOfBirth', value)}
      />
      <CountrySelectField
        id="nationality"
        label="Nationality"
        value={form.nationality}
        countries={countries}
        loading={countriesLoading}
        error={errors.nationality}
        placeholder="Select nationality"
        onChange={(value) => onChange('nationality', value)}
      />
      <CountrySelectField
        id="idIssuingCountry"
        label="ID issuing country"
        value={form.idIssuingCountry}
        countries={countries}
        loading={countriesLoading}
        error={errors.idIssuingCountry}
        placeholder="Select issuing country"
        onChange={(value) => onChange('idIssuingCountry', value)}
      />
      <FormField
        id="maritalStatus"
        label="Marital status"
        required
        error={errors.maritalStatus}
      >
        <select
          id="maritalStatus"
          name="maritalStatus"
          value={form.maritalStatus}
          onChange={(event) => onChange('maritalStatus', event.target.value)}
          aria-invalid={Boolean(errors.maritalStatus)}
        >
          <option value="">Select status</option>
          {maritalStatusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </FormField>
    </FormSection>
  )
}
