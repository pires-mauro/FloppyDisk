import { dialPrefixes } from '../form/options'
import { FormField } from './FormField'

type PhoneNumberFieldProps = {
  prefix: string
  number: string
  prefixError?: string
  numberError?: string
  onPrefixChange: (value: string) => void
  onNumberChange: (value: string) => void
}

export function PhoneNumberField({
  prefix,
  number,
  prefixError,
  numberError,
  onPrefixChange,
  onNumberChange,
}: PhoneNumberFieldProps) {
  return (
    <FormField
      id="phoneNumber"
      label="Phone number"
      required
      error={numberError ?? prefixError}
      hint="Digits only, without the international prefix."
    >
      <div className="phone-input">
        <select
          id="dialPrefix"
          name="dialPrefix"
          value={prefix}
          onChange={(event) => onPrefixChange(event.target.value)}
          aria-label="International dial prefix"
          aria-invalid={Boolean(prefixError)}
        >
          <option value="">Prefix</option>
          {dialPrefixes.map((dialPrefix) => (
            <option key={dialPrefix} value={dialPrefix}>{dialPrefix}</option>
          ))}
        </select>
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={number}
          onChange={(event) =>
            onNumberChange(event.target.value.replace(/\D/g, ''))
          }
          placeholder="612 345 678"
          aria-invalid={Boolean(numberError)}
          aria-describedby={
            numberError ? 'phoneNumber-error' : 'phoneNumber-hint'
          }
        />
      </div>
    </FormField>
  )
}
