import { deriveServerSecret } from './session';

/** The key shift and period receipts are signed with, derived from the session secret. */
export function receiptSecret(): string {
  return deriveServerSecret('shift-receipt');
}
