import type { Country } from '../form/types'
import { FormField } from './FormField'

type CountrySelectFieldProps = {
  id: string
  label: string
  value: string
  countries: Country[]
  loading: boolean
  error?: string
  placeholder?: string
  onChange: (value: string) => void
}

export function CountrySelectField({
  id,
  label,
  value,
  countries,
  loading,
  error,
  placeholder = 'Select country',
  onChange,
}: CountrySelectFieldProps) {
  return (
    <FormField id={id} label={label} required error={error}>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        disabled={loading}
      >
        <option value="">
          {loading ? 'Loading countries…' : placeholder}
        </option>
        {countries.map(({ code, name }) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </FormField>
  )
}
