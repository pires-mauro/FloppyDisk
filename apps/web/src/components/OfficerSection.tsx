import type { ClientForm, FieldErrors } from '../form/types'
import { FormField } from './FormField'
import { FormSection } from './FormSection'

type OfficerSectionProps = {
  form: ClientForm
  errors: FieldErrors
  onChange: (field: keyof ClientForm, value: string) => void
  onRiskFlagChange: (
    field: 'pepConfirmed' | 'sanctionsMatch',
    value: boolean,
  ) => void
}

export function OfficerSection({
  form,
  errors,
  onChange,
  onRiskFlagChange,
}: OfficerSectionProps) {
  return (
    <FormSection
      number="04"
      title="Officer details"
      description="Internal reference and review notes"
      iconClassName="officer-icon"
      icon={
        <svg viewBox="0 0 24 24">
          <path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      }
    >
      <FormField
        id="officerId"
        label="Officer internal ID"
        required
        error={errors.officerId}
        hint="Exactly 10 digits"
      >
        <input
          id="officerId"
          name="officerId"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          value={form.officerId}
          onChange={(event) =>
            onChange(
              'officerId',
              event.target.value.replace(/\D/g, '').slice(0, 10),
            )
          }
          placeholder="e.g. 0123456789"
          aria-invalid={Boolean(errors.officerId)}
          aria-describedby={
            errors.officerId ? 'officerId-error' : 'officerId-hint'
          }
        />
      </FormField>
      <FormField
        id="officerComment"
        label="Officer comment"
        error={errors.officerComment}
        hint={`${form.officerComment.length}/500 characters`}
      >
        <textarea
          id="officerComment"
          name="officerComment"
          value={form.officerComment}
          onChange={(event) => onChange('officerComment', event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Add any relevant context for the review…"
          aria-invalid={Boolean(errors.officerComment)}
          aria-describedby={
            errors.officerComment
              ? 'officerComment-error'
              : 'officerComment-hint'
          }
        />
      </FormField>
      <div className="risk-flag-fields" role="group" aria-labelledby="risk-flags-label">
        <p id="risk-flags-label">PEP & sanctions screening</p>
        <label className="risk-flag-option">
          <input
            type="checkbox"
            checked={form.pepConfirmed}
            onChange={(event) =>
              onRiskFlagChange('pepConfirmed', event.target.checked)
            }
          />
          <span>Politically exposed person (PEP) confirmed</span>
        </label>
        <label className="risk-flag-option">
          <input
            type="checkbox"
            checked={form.sanctionsMatch}
            onChange={(event) =>
              onRiskFlagChange('sanctionsMatch', event.target.checked)
            }
          />
          <span>Sanctions list match</span>
        </label>
      </div>
    </FormSection>
  )
}
