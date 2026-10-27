import type { ClientForm, FieldErrors } from './types'
import { requiredFields } from './options'

export function getToday() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

export function parseDateOfBirth(dateOfBirth: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateOfBirth)
  if (!match) return null

  const [, dayValue, monthValue, yearValue] = match
  const day = Number(dayValue)
  const month = Number(monthValue)
  const year = Number(yearValue)
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function formatDateOfBirth(isoDate: string) {
  const [year, month, day] = isoDate.split('-')
  return `${day}-${month}-${year}`
}

export function toISODate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateOfBirthPickerValue(value: string) {
  const date = parseDateOfBirth(value)
  return date ? toISODate(date) : ''
}

function isAtLeastEighteen(dateOfBirth: Date) {
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const birthdayHasNotPassed =
    today.getMonth() < dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() < dateOfBirth.getDate())

  if (birthdayHasNotPassed) age -= 1
  return age >= 18
}

function isValidEmail(email: string) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email,
  )
}

export function validateForm(form: ClientForm): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of requiredFields) {
    if (!form[field].trim()) errors[field] = 'This field is required.'
  }

  if (form.clientName.length > 100) {
    errors.clientName = 'Enter no more than 100 characters.'
  }
  if (form.clientId.length > 100) {
    errors.clientId = 'Enter no more than 100 characters.'
  }
  if (form.officerId && !/^\d{10}$/.test(form.officerId)) {
    errors.officerId = 'Enter exactly 10 digits.'
  }
  if (form.email && !isValidEmail(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (form.phoneNumber && !/^\d+$/.test(form.phoneNumber)) {
    errors.phoneNumber = 'Use digits only for the local number.'
  }
  if (form.dateOfBirth) {
    const dateOfBirth = parseDateOfBirth(form.dateOfBirth)
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Enter a valid date in DD-MM-YYYY format.'
    } else if (toISODate(dateOfBirth) > getToday()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.'
    } else if (!isAtLeastEighteen(dateOfBirth)) {
      errors.dateOfBirth = 'The client must be at least 18 years old.'
    }
  }
  if (form.officerComment.length > 500) {
    errors.officerComment = 'Enter no more than 500 characters.'
  }

  return errors
}
