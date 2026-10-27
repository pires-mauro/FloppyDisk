export type Country = {
  code: string
  name: string
}

export type ClientForm = {
  clientName: string
  clientId: string
  dateOfBirth: string
  countryOfResidence: string
  taxDomicile: string
  nationality: string
  idIssuingCountry: string
  annualIncome: string
  profession: string
  maritalStatus: string
  email: string
  dialPrefix: string
  phoneNumber: string
  officerId: string
  officerComment: string
}

export type FieldErrors = Partial<Record<keyof ClientForm, string>>

export const initialForm: ClientForm = {
  clientName: '',
  clientId: '',
  dateOfBirth: '',
  countryOfResidence: '',
  taxDomicile: '',
  nationality: '',
  idIssuingCountry: '',
  annualIncome: '',
  profession: '',
  maritalStatus: '',
  email: '',
  dialPrefix: '',
  phoneNumber: '',
  officerId: '',
  officerComment: '',
}
