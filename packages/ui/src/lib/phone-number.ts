import { formatPhoneNumberIntl } from "react-phone-number-input"

/** Formats a canonical phone value for international display when possible. */
export function formatPhoneNumberForDisplay(value: string): string {
  return formatPhoneNumberIntl(value) || value
}
