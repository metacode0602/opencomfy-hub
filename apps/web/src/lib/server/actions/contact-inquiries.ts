/**
 * Persist contact inquiries; replace with real persistence (e.g. Drizzle) when ready.
 */
const contactInquiriesDataAccess = {
  async createContactInquiry(input: { name: string; phone: string; email: string; message: string }) {
    console.info('[contact-inquiries] stub create', input.email)
    return { id: 'stub' as const }
  },
}

export default contactInquiriesDataAccess
