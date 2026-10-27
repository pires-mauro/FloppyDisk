import { useRef } from 'react'
import { dateOfBirthPickerValue, formatDateOfBirth, getToday } from '../form/validation'
import { FormField } from './FormField'

type DateOfBirthFieldProps = {
  value: string
  error?: string
  onChange: (value: string) => void
}

export function DateOfBirthField({
  value,
  error,
  onChange,
}: DateOfBirthFieldProps) {
  const datePicker = useRef<HTMLInputElement>(null)

  function openDatePicker() {
    const input = datePicker.current
    if (!input) return

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  return (
    <FormField
      id="dateOfBirth"
      label="Date of birth"
      required
      error={error}
      hint="Enter DD-MM-YYYY or use the calendar."
    >
      <div className="date-picker-control" onClick={openDatePicker}>
        <input
          className="date-picker-input"
          id="dateOfBirth"
          name="dateOfBirth"
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-YYYY"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="bday"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'dateOfBirth-error' : 'dateOfBirth-hint'}
        />
        <input
          ref={datePicker}
          className="native-date-picker"
          type="date"
          value={dateOfBirthPickerValue(value)}
          onChange={(event) =>
            onChange(
              event.target.value ? formatDateOfBirth(event.target.value) : '',
            )
          }
          max={getToday()}
          tabIndex={-1}
          aria-hidden="true"
        />
        <svg className="date-picker-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="6" width="16" height="15" rx="2.5" />
          <path d="M8 3.5v5M16 3.5v5M4 10h16M8 14h2M14 14h2M8 17.5h2" />
        </svg>
      </div>
    </FormField>
  )
}
