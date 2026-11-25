import { useEffect, useRef, useState } from 'react'
import {
  formatDateOfBirth,
  getLatestAdultBirthDate,
  parseDateOfBirth,
  toISODate,
} from '../form/validation'
import { FormField } from './FormField'

type DateOfBirthFieldProps = {
  value: string
  error?: string
  onChange: (value: string) => void
}

type CalendarView = 'days' | 'months' | 'years'

export function DateOfBirthField({
  value,
  error,
  onChange,
}: DateOfBirthFieldProps) {
  const control = useRef<HTMLDivElement>(null)
  const latestAdultBirthDate = getLatestAdultBirthDate()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarView, setCalendarView] = useState<CalendarView>('days')
  const [yearPageStart, setYearPageStart] = useState(0)
  const [displayMonth, setDisplayMonth] = useState(() => {
    const selected = parseDateOfBirth(value)
    const initialDate = selected ?? new Date(`${latestAdultBirthDate}T00:00:00`)
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  })

  useEffect(() => {
    if (!calendarOpen) return

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !control.current?.contains(event.target)) {
        setCalendarOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [calendarOpen])

  const firstDayOffset = new Date(
    displayMonth.getFullYear(),
    displayMonth.getMonth(),
    1,
  ).getDay()
  const daysInMonth = new Date(
    displayMonth.getFullYear(),
    displayMonth.getMonth() + 1,
    0,
  ).getDate()
  const selectedDate = parseDateOfBirth(value)
  const latestDate = new Date(`${latestAdultBirthDate}T00:00:00`)
  const latestMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(displayMonth)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function changeMonth(offset: number) {
    setDisplayMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
  }

  function showYears() {
    setYearPageStart(Math.floor(displayMonth.getFullYear() / 12) * 12)
    setCalendarView('years')
  }

  function selectYear(year: number) {
    setDisplayMonth((current) => new Date(year, current.getMonth(), 1))
    setCalendarView('months')
  }

  function selectMonth(month: number) {
    setDisplayMonth((current) =>
      new Date(current.getFullYear(), month, 1),
    )
    setCalendarView('days')
  }

  function toggleCalendar() {
    if (calendarOpen) {
      setCalendarOpen(false)
    } else {
      openCalendar()
    }
  }

  function openCalendar() {
    if (calendarOpen) return
    const selected = parseDateOfBirth(value)
    const initialDate = selected ?? latestDate
    setDisplayMonth(
      new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
    )
    setCalendarView('days')
    setCalendarOpen(true)
  }

  return (
    <FormField
      id="dateOfBirth"
      label="Date of birth"
      required
      error={error}
      hint="Select a date or enter DD-MM-YYYY. The client must be at least 18."
    >
      <div className="date-picker-control" ref={control}>
        <input
          className="date-picker-input"
          id="dateOfBirth"
          name="dateOfBirth"
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-YYYY"
          value={value}
          onClick={openCalendar}
          onChange={(event) => {
            const nextValue = event.target.value
            onChange(nextValue)
            const selected = parseDateOfBirth(nextValue)
            if (selected) {
              setDisplayMonth(
                new Date(selected.getFullYear(), selected.getMonth(), 1),
              )
            }
          }}
          autoComplete="bday"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'dateOfBirth-error' : 'dateOfBirth-hint'}
        />
        <button
          className="date-picker-toggle"
          type="button"
          aria-label={calendarOpen ? 'Close calendar' : 'Open calendar'}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          onClick={toggleCalendar}
        >
          <svg className="date-picker-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="6" width="16" height="15" rx="2.5" />
            <path d="M8 3.5v5M16 3.5v5M4 10h16M8 14h2M14 14h2M8 17.5h2" />
          </svg>
        </button>
        {calendarOpen && (
          <div
            className="date-picker-calendar"
            role="dialog"
            aria-label="Choose date of birth"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCalendarOpen(false)
            }}
          >
            <div className="calendar-heading">
              <button
                type="button"
                className="calendar-nav"
                aria-label={
                  calendarView === 'years'
                    ? 'Previous 12 years'
                    : calendarView === 'months'
                      ? 'Previous year'
                      : 'Previous month'
                }
                disabled={
                  calendarView === 'years'
                    ? yearPageStart < 12
                    : calendarView === 'months'
                      ? displayMonth.getFullYear() <= 1
                      : false
                }
                onClick={() => {
                  if (calendarView === 'years') {
                    setYearPageStart((start) => Math.max(0, start - 12))
                  } else if (calendarView === 'months') {
                    setDisplayMonth((current) =>
                      new Date(current.getFullYear() - 1, current.getMonth(), 1),
                    )
                  } else {
                    changeMonth(-1)
                  }
                }}
              >
                ‹
              </button>
              <div className="calendar-title-controls">
                {calendarView === 'years' ? (
                  <strong>{yearPageStart + 1}–{Math.min(yearPageStart + 12, latestDate.getFullYear())}</strong>
                ) : (
                  <>
                    <button
                      type="button"
                      className="calendar-title-button"
                      aria-label="Choose month"
                      aria-pressed={calendarView === 'months'}
                      onClick={() =>
                        setCalendarView((current) =>
                          current === 'months' ? 'days' : 'months',
                        )
                      }
                    >
                      {new Intl.DateTimeFormat(undefined, { month: 'long' }).format(displayMonth)}
                    </button>
                    <button
                      type="button"
                      className="calendar-title-button"
                      aria-label="Choose year"
                      onClick={showYears}
                    >
                      {displayMonth.getFullYear()}
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                className="calendar-nav"
                aria-label={
                  calendarView === 'years'
                    ? 'Next 12 years'
                    : calendarView === 'months'
                      ? 'Next year'
                      : 'Next month'
                }
                disabled={
                  calendarView === 'years'
                    ? yearPageStart + 12 > latestDate.getFullYear()
                    : calendarView === 'months'
                      ? displayMonth.getFullYear() >= latestDate.getFullYear()
                      : displayMonth.getFullYear() === latestMonth.getFullYear() &&
                        displayMonth.getMonth() === latestMonth.getMonth()
                }
                onClick={() => {
                  if (calendarView === 'years') {
                    setYearPageStart((start) => start + 12)
                  } else if (calendarView === 'months') {
                    setDisplayMonth((current) =>
                      new Date(current.getFullYear() + 1, current.getMonth(), 1),
                    )
                  } else {
                    changeMonth(1)
                  }
                }}
              >
                ›
              </button>
            </div>
            {calendarView === 'days' && (
              <div className="calendar-grid" role="grid" aria-label={monthLabel}>
                {weekdays.map((weekday) => (
                  <span className="calendar-weekday" role="columnheader" key={weekday}>
                    {weekday}
                  </span>
                ))}
                {Array.from({ length: firstDayOffset }, (_, index) => (
                  <span className="calendar-blank" role="gridcell" key={`blank-${index}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1
                  const date = new Date(
                    displayMonth.getFullYear(),
                    displayMonth.getMonth(),
                    day,
                  )
                  const isoDate = toISODate(date)
                  const isTooYoung = isoDate > latestAdultBirthDate
                  const isSelected =
                    selectedDate !== null &&
                    selectedDate.getFullYear() === date.getFullYear() &&
                    selectedDate.getMonth() === date.getMonth() &&
                    selectedDate.getDate() === date.getDate()

                  return (
                    <button
                      className="calendar-day"
                      type="button"
                      role="gridcell"
                      key={day}
                      disabled={isTooYoung}
                      aria-current={isSelected ? 'date' : undefined}
                      aria-label={new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'full',
                      }).format(date)}
                      onClick={() => {
                        onChange(formatDateOfBirth(isoDate))
                        setCalendarOpen(false)
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            )}
            {calendarView === 'months' && (
              <div className="calendar-choice-grid" aria-label="Choose month">
                {Array.from({ length: 12 }, (_, month) => {
                  const date = new Date(displayMonth.getFullYear(), month, 1)
                  const isTooYoung =
                    date.getFullYear() > latestDate.getFullYear() ||
                    (date.getFullYear() === latestDate.getFullYear() &&
                      month > latestDate.getMonth())
                  return (
                    <button
                      className="calendar-choice"
                      type="button"
                      key={month}
                      disabled={isTooYoung}
                      aria-pressed={displayMonth.getMonth() === month}
                      onClick={() => selectMonth(month)}
                    >
                      {new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)}
                    </button>
                  )
                })}
              </div>
            )}
            {calendarView === 'years' && (
              <div className="calendar-choice-grid calendar-year-grid" aria-label="Choose year">
                {Array.from({ length: 12 }, (_, index) => yearPageStart + index + 1)
                  .filter((year) => year <= latestDate.getFullYear())
                  .map((year) => (
                    <button
                      className="calendar-choice"
                      type="button"
                      key={year}
                      aria-pressed={displayMonth.getFullYear() === year}
                      onClick={() => selectYear(year)}
                    >
                      {year}
                    </button>
                  ))}
              </div>
            )}
            <p className="calendar-cutoff">
              Latest eligible birth date: {formatDateOfBirth(latestAdultBirthDate)}
            </p>
          </div>
        )}
      </div>
    </FormField>
  )
}
