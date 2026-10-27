import type { ReactNode } from 'react'

type FormSectionProps = {
  number: string
  title: string
  description: string
  icon: ReactNode
  iconClassName: string
  children: ReactNode
}

export function FormSection({
  number,
  title,
  description,
  icon,
  iconClassName,
  children,
}: FormSectionProps) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <div className={`section-icon ${iconClassName}`} aria-hidden="true">
          {icon}
        </div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="section-number">{number}</span>
      </div>
      <div className="field-grid">{children}</div>
    </section>
  )
}
