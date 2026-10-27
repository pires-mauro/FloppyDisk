import type { ClientForm, FieldErrors } from '../form/types'
import { FormField } from './FormField'
import { FormSection } from './FormSection'
import { PhoneNumberField } from './PhoneNumberField'

type ContactSectionProps = {
  form: ClientForm
  errors: FieldErrors
  onChange: (field: keyof ClientForm, value: string) => void
}

export function ContactSection({
  form,
  errors,
  onChange,
}: ContactSectionProps) {
  return (
    <FormSection
      number="03"
      title="Contact information"
      description="How we can reach the client"
      iconClassName="contact-icon"
      icon={
        <svg viewBox="0 0 24 24">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m5 8 7 5 7-5" />
        </svg>
      }
    >
      <FormField
        id="email"
        label="Email address"
        required
        error={errors.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
          autoComplete="email"
          placeholder="name@example.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
      </FormField>
      <PhoneNumberField
        prefix={form.dialPrefix}
        number={form.phoneNumber}
        prefixError={errors.dialPrefix}
        numberError={errors.phoneNumber}
        onPrefixChange={(value) => onChange('dialPrefix', value)}
        onNumberChange={(value) => onChange('phoneNumber', value)}
      />
    </FormSection>
  )
}
