/**
 * Optional SMS notify when a contact form is submitted.
 * Implement with your SMS provider when needed.
 */
export async function sendInquiryNotifySms(_input: {
  name: string
  email: string
  message: string
  phone?: string
}): Promise<void> {}
