import type { Country, ClientForm } from './types'

const unMemberCountryCodes = `
AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG
BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ KP DK DJ DM DO
EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU
IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU
MG MW MY MV ML MT MH MR MU MX FM MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG
MK NO OM PK PW PA PG PY PE PH PL PT QA KR MD RO RU RW KN LC VC WS SM ST SA
SN RS SC SL SG SK SI SB SO ZA ES LK SD SS SR SE CH SY TJ TH TL TG TO TT TN TR
TM TV UG UA AE GB TZ US UY UZ VU VE VN YE ZM ZW
`
  .trim()
  .split(/\s+/)

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export const unCountries: Country[] = unMemberCountryCodes
  .map((code) => ({ code, name: regionNames.of(code) ?? code }))
  .sort((left, right) => left.name.localeCompare(right.name))

export const incomeOptions = ['0-10k', '10k-50k', '50k-100k', '100k+']
export const professionOptions = ['Standard', 'Cash-intensive', 'High-risk']
export const maritalStatusOptions = [
  'Single',
  'Married',
  'Divorced',
  'Widowed',
  'Separated',
]

export const dialPrefixes = [
  '+1', '+7', '+20', '+27', '+30', '+31', '+32', '+33', '+34', '+36', '+39',
  '+40', '+41', '+43', '+44', '+45', '+46', '+47', '+48', '+49', '+51', '+52',
  '+53', '+54', '+55', '+56', '+57', '+58', '+60', '+61', '+62', '+63', '+64',
  '+65', '+66', '+81', '+82', '+84', '+86', '+90', '+91', '+92', '+93', '+94',
  '+95', '+98', '+211', '+212', '+213', '+216', '+218', '+220', '+221', '+222',
  '+223', '+224', '+225', '+226', '+227', '+228', '+229', '+230', '+231', '+232',
  '+233', '+234', '+235', '+236', '+237', '+238', '+239', '+240', '+241', '+242',
  '+243', '+244', '+245', '+246', '+247', '+248', '+249', '+250', '+251', '+252',
  '+253', '+254', '+255', '+256', '+257', '+258', '+260', '+261', '+262', '+263',
  '+264', '+265', '+266', '+267', '+268', '+269', '+290', '+291', '+297', '+298',
  '+299', '+350', '+351', '+352', '+353', '+354', '+355', '+356', '+357', '+358',
  '+359', '+370', '+371', '+372', '+373', '+374', '+375', '+376', '+377', '+378',
  '+380', '+381', '+382', '+383', '+385', '+386', '+387', '+389', '+420', '+421',
  '+423', '+500', '+501', '+502', '+503', '+504', '+505', '+506', '+507', '+508',
  '+509', '+590', '+591', '+592', '+593', '+594', '+595', '+596', '+597', '+598',
  '+599', '+670', '+672', '+673', '+674', '+675', '+676', '+677', '+678', '+679',
  '+680', '+681', '+682', '+683', '+685', '+686', '+687', '+688', '+689', '+690',
  '+691', '+692', '+850', '+852', '+853', '+855', '+856', '+880', '+886', '+960',
  '+961', '+962', '+963', '+964', '+965', '+966', '+967', '+968', '+970', '+971',
  '+972', '+973', '+974', '+975', '+976', '+977', '+992', '+993', '+994', '+995',
  '+996', '+998',
].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))

export const requiredFields: Exclude<
  keyof ClientForm,
  'pepConfirmed' | 'sanctionsMatch'
>[] = [
  'clientName',
  'dateOfBirth',
  'countryOfResidence',
  'taxDomicile',
  'nationality',
  'idIssuingCountry',
  'annualIncome',
  'profession',
  'maritalStatus',
  'email',
  'dialPrefix',
  'phoneNumber',
  'officerId',
]
